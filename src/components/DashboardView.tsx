import React, { useState, useEffect, useMemo } from "react";
import {
  AlertTriangle,
  Receipt,
  ArrowUpRight,
  ArrowDownLeft,
  Boxes,
  Landmark,
  Wallet,
  ShieldCheck,
  X,
  FileText,
  Scale,
  ArrowRight,
  TrendingUp,
  PackageCheck,
  Building2,
  PieChart,
  ShoppingBag,
  Sparkles,
  Users,
  Clock,
  Shield,
  Coins,
} from "lucide-react";
import { CurrencyIcon } from "./common/CurrencyIcon";
import type { DashboardSummary, Settings, Party, BankAccount, Invoice, Item, Expense } from "../types";
import { api } from "../services/api";
import { getLocalDateString } from "../utils/date";
import { useAppleDialog } from "./common/AppleDialog";
import { AppleSelect } from "./common/AppleSelect";
import { useCurrency } from "../context/CurrencyContext";
import type { GstSettings } from "../modules/india_gst/gstTypes";
import { gstApi } from "../modules/india_gst/gstApi";
import { ManageMoneyModal } from "./ManageMoneyModal";
import { ExecutiveProDashboard } from "./ExecutiveProDashboard";

interface DashboardViewProps {
  summary: DashboardSummary | null;
  settings: Settings;
  parties?: Party[];
  gstSettings?: GstSettings | null;
  onNavigate: (tab: string) => void;
  onRefresh?: () => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  summary,
  settings,
  parties = [],
  gstSettings,
  onNavigate,
  onRefresh,
}) => {
  const { currencySymbol, formatCurrency } = useCurrency();
  const currency = currencySymbol || settings.currency_symbol || "$";
  const { alert, toast } = useAppleDialog();

  const [dashboardStyle, setDashboardStyle] = useState<"pro" | "classic">(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("lynterminal_dashboard_style");
      if (saved === "classic") return "classic";
      const p = new URLSearchParams(window.location.search).get("style");
      if (p === "classic") return "classic";
    }
    return "pro";
  });

  const handleSetStyle = (style: "pro" | "classic") => {
    setDashboardStyle(style);
    if (typeof window !== "undefined") {
      localStorage.setItem("lynterminal_dashboard_style", style);
    }
  };

  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [isPaySupplierOpen, setIsPaySupplierOpen] = useState(false);
  const [isManageMoneyOpen, setIsManageMoneyOpen] = useState(false);
  const [manageMoneyTab, setManageMoneyTab] = useState<"deposit" | "transfer" | "manage">("deposit");
  const [manageMoneyDest, setManageMoneyDest] = useState<"CASH" | "BANK" | "CAPITAL">("CASH");

  const handleOpenManageMoney = (tab: "deposit" | "transfer" | "manage" = "deposit", dest: "CASH" | "BANK" | "CAPITAL" = "CASH") => {
    setManageMoneyTab(tab);
    setManageMoneyDest(dest);
    setIsManageMoneyOpen(true);
  };

  // Indian GST Engine toggle state
  const isGstEnabled = gstSettings?.is_enabled ?? true;
  const isIndiaCurrency = settings.currency_code === "INR";
  const [isUpdatingGst, setIsUpdatingGst] = useState(false);

  const handleToggleGst = async (enable: boolean) => {
    try {
      setIsUpdatingGst(true);
      const current = gstSettings || (await gstApi.getGstSettings().catch(() => null));
      if (current) {
        await gstApi.saveGstSettings({
          ...current,
          is_enabled: enable,
        });
      } else {
        await gstApi.saveGstSettings({
          is_enabled: enable,
          gstin: "",
          legal_name: settings.business_name || "Business Enterprise",
          trade_name: settings.business_name || "Business Enterprise",
          state_code: "27",
          state_name: "Maharashtra",
          pan: "",
          gst_composition: false,
          einvoice_enabled: false,
          eway_bill_threshold: 50000,
          lut_number: "",
          bank_name: "",
          bank_account_no: "",
          bank_ifsc: "",
          bank_branch: "",
          upi_id: "",
        });
      }
      toast({
        message: `Indian GST & Statutory Accounting Engine ${enable ? "Enabled" : "Disabled"}.`,
        type: "success",
      });
      if (onRefresh) onRefresh();
    } catch (err) {
      alert({ title: "GST Settings Error", message: String(err), type: "error" });
    } finally {
      setIsUpdatingGst(false);
    }
  };

  // Customer Credit & Outstanding Ledger state
  const [creditRankingMode, setCreditRankingMode] = useState<"amount" | "age">("amount");
  const [dashboardPayTarget, setDashboardPayTarget] = useState<Invoice | null>(null);
  const [dashboardPayAmount, setDashboardPayAmount] = useState<string>("");
  const [dashboardPayMethod, setDashboardPayMethod] = useState<string>("CASH");
  const [isSubmittingDashboardPay, setIsSubmittingDashboardPay] = useState<boolean>(false);

  // Debtor customer accounts (ranked by credit amount: largest to smallest, 1 to endless)
  const debtorCustomers = useMemo(() => {
    return parties
      .filter((p) => p.party_type === "CUSTOMER" && p.current_balance > 0.009)
      .sort((a, b) => b.current_balance - a.current_balance);
  }, [parties]);

  // Unsettled credit sale records (ranked by age: oldest to newest)
  const creditInvoicesByAge = useMemo(() => {
    return invoices
      .filter((inv) => {
        const remaining = inv.total_amount - (inv.paid_amount || 0);
        return (
          inv.invoice_type === "SALE" &&
          (inv.status === "CREDIT" || inv.status === "PARTIAL" || inv.status === "UNPAID") &&
          remaining > 0.009
        );
      })
      .sort((a, b) => {
        const diff = new Date(a.invoice_date).getTime() - new Date(b.invoice_date).getTime();
        if (diff !== 0) return diff;
        const createdDiff = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        if (createdDiff !== 0) return createdDiff;
        return a.invoice_number.localeCompare(b.invoice_number);
      });
  }, [invoices]);

  const totalOutstandingCustomerCredit = debtorCustomers.reduce(
    (sum, c) => sum + c.current_balance,
    0
  );

  const handleOpenDashboardCreditPay = (inv: Invoice) => {
    setDashboardPayTarget(inv);
    const due = Math.max(0, inv.total_amount - (inv.paid_amount || 0));
    setDashboardPayAmount(due > 0 ? due.toFixed(2) : inv.total_amount.toFixed(2));
    setDashboardPayMethod("CASH");
  };

  const handleOpenCustomerCreditPay = (cust: Party) => {
    const syntheticInv: Invoice = {
      id: "",
      invoice_number: "ACCOUNT-BAL",
      invoice_type: "SALE",
      party_id: cust.id,
      party_name: cust.name,
      invoice_date: getLocalDateString(),
      due_date: getLocalDateString(),
      subtotal: cust.current_balance,
      discount_amount: 0,
      tax_amount: 0,
      total_amount: cust.current_balance,
      paid_amount: 0,
      status: "CREDIT",
      payment_method: "Credit",
      notes: `Balance on account for ${cust.name}`,
      created_at: new Date().toISOString(),
    };
    handleOpenDashboardCreditPay(syntheticInv);
  };

  const handleExecuteDashboardCreditPay = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!dashboardPayTarget) return;

    const amt = parseFloat(dashboardPayAmount);
    if (isNaN(amt) || amt <= 0) {
      alert({ title: "Validation Error", message: "Please enter a valid payment amount.", type: "warning" });
      return;
    }

    try {
      setIsSubmittingDashboardPay(true);
      await api.recordPayment({
        id: "",
        invoice_id: dashboardPayTarget.id ? dashboardPayTarget.id : null,
        party_id: dashboardPayTarget.party_id || "",
        party_name: dashboardPayTarget.party_name || "Customer",
        amount: amt,
        payment_type: "IN",
        payment_method: dashboardPayMethod,
        payment_date: getLocalDateString(),
        reference: dashboardPayTarget.id ? `Credit Settlement #${dashboardPayTarget.invoice_number}` : `Account Settlement - ${dashboardPayTarget.party_name}`,
        notes: dashboardPayTarget.id ? `Credit settlement for Invoice #${dashboardPayTarget.invoice_number}` : `Customer account settlement`,
      });
      setDashboardPayTarget(null);
      toast({ message: `Successfully settled payment of ${formatCurrency(amt)}`, type: "success" });
      if (onRefresh) onRefresh();
      loadData();
    } catch (err) {
      alert({ title: "Payment Failed", message: String(err), type: "error" });
    } finally {
      setIsSubmittingDashboardPay(false);
    }
  };

  // Pay supplier state
  const [supplierId, setSupplierId] = useState("");
  const [supplierAmount, setSupplierAmount] = useState("");
  const [supplierMethod, setSupplierMethod] = useState<"CASH" | "BANK">("CASH");
  const [supplierBankId, setSupplierBankId] = useState("");
  const [supplierRef, setSupplierRef] = useState("");
  const [supplierNotes, setSupplierNotes] = useState("Settlement of vendor balance");
  const [isSubmittingPay, setIsSubmittingPay] = useState(false);

  const loadData = async () => {
    try {
      const [invList, itemList, banks, expList] = await Promise.all([
        api.listInvoices().catch(() => []),
        api.listItems().catch(() => []),
        api.listBankAccounts().catch(() => []),
        api.listExpenses().catch(() => []),
      ]);
      setInvoices(invList);
      setItems(itemList);
      setBankAccounts(banks);
      setExpenses(expList);
      if (banks.length > 0) {
        setSupplierBankId(banks[0].id);
      }
    } catch (e) {
      console.error("Failed to load dashboard data:", e);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const vendors = parties.filter((p) => p.party_type === "VENDOR");

  const handleOpenPaySupplier = (vendor?: Party) => {
    if (vendor) {
      setSupplierId(vendor.id);
      setSupplierAmount(Math.abs(vendor.current_balance).toString());
    } else if (vendors.length > 0) {
      setSupplierId(vendors[0].id);
      setSupplierAmount(Math.abs(vendors[0].current_balance).toString());
    }
    setIsPaySupplierOpen(true);
  };

  const handleExecutePaySupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supplierId) {
      alert({ title: "Validation Error", message: "Please select a vendor.", type: "warning" });
      return;
    }
    const amt = parseFloat(supplierAmount);
    if (isNaN(amt) || amt <= 0) {
      alert({ title: "Validation Error", message: "Please enter a valid payment amount.", type: "warning" });
      return;
    }

    const v = vendors.find((p) => p.id === supplierId);

    try {
      setIsSubmittingPay(true);
      await api.paySupplierBill({
        party_id: supplierId,
        party_name: v ? v.name : "Supplier",
        amount: amt,
        payment_method: supplierMethod,
        bank_account_id: supplierMethod === "BANK" ? supplierBankId : null,
        reference: supplierRef,
        notes: supplierNotes,
      });
      setIsPaySupplierOpen(false);
      toast({ message: `Successfully settled ${formatCurrency(amt)} to ${v?.name || "Supplier"}`, type: "success" });
      if (onRefresh) onRefresh();
      loadData();
    } catch (err) {
      alert({ title: "Payment Failed", message: String(err), type: "error" });
    } finally {
      setIsSubmittingPay(false);
    }
  };

  // 7-day revenue trend
  const last7Days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    const dateStr = getLocalDateString(d);
    const dayName = d.toLocaleDateString("en-US", { weekday: "short" });
    const daySales = invoices
      .filter((inv) => inv.invoice_type === "SALE" && inv.invoice_date === dateStr)
      .reduce((sum, inv) => sum + inv.total_amount, 0);
    const dayCount = invoices.filter((inv) => inv.invoice_type === "SALE" && inv.invoice_date === dateStr).length;
    return { dateStr, dayName, daySales, dayCount };
  });

  const maxDaySales = Math.max(...last7Days.map((d) => d.daySales), 1);
  const total7DaySales = last7Days.reduce((sum, d) => sum + d.daySales, 0);
  const avgDailySales = total7DaySales / 7;

  // Category distribution
  const categories = Array.from(new Set(items.map((it) => it.category || "General")));
  const categoryStats = categories.map((cat, idx) => {
    const catItems = items.filter((it) => (it.category || "General") === cat);
    const totalValue = catItems.reduce((sum, it) => sum + it.stock_quantity * it.sale_price, 0);
    const totalStock = catItems.reduce((sum, it) => sum + it.stock_quantity, 0);
    const colors = [
      { bg: "bg-[#0071E3]", text: "text-[#0071E3]", light: "bg-[#0071E3]/10", border: "border-[#0071E3]/20" },
      { bg: "bg-[#34C759]", text: "text-[#34C759]", light: "bg-[#34C759]/10", border: "border-[#34C759]/20" },
      { bg: "bg-[#FF9500]", text: "text-[#FF9500]", light: "bg-[#FF9500]/10", border: "border-[#FF9500]/20" },
      { bg: "bg-[#AF52DE]", text: "text-[#AF52DE]", light: "bg-[#AF52DE]/10", border: "border-[#AF52DE]/20" },
      { bg: "bg-[#00C7BE]", text: "text-[#00C7BE]", light: "bg-[#00C7BE]/10", border: "border-[#00C7BE]/20" },
      { bg: "bg-[#FF2D55]", text: "text-[#FF2D55]", light: "bg-[#FF2D55]/10", border: "border-[#FF2D55]/20" },
    ];
    const color = colors[idx % colors.length];
    return { category: cat, itemCount: catItems.length, totalStock, totalValue, color };
  });
  const totalCategoryValuation = categoryStats.reduce((sum, c) => sum + c.totalValue, 0) || 1;

  // Top products
  const topProducts = [...items]
    .sort((a, b) => (b.stock_quantity * b.sale_price) - (a.stock_quantity * a.sale_price))
    .slice(0, 5);

  // Recent sales invoices
  const recentSales = invoices
    .filter((inv) => inv.invoice_type === "SALE")
    .slice(0, 6);

  const totalAssets = summary?.total_assets ?? (
    (summary?.cash_in_hand || 0) +
    (summary?.cash_in_bank || 0) +
    (summary?.total_receivables || 0) +
    (summary?.total_stock_value || 0)
  );

  const totalLiabilities = summary?.total_payables || 0;
  const netWorth = summary?.net_worth ?? (totalAssets - totalLiabilities);

  return (
    <div className="select-none">
      {dashboardStyle === "pro" ? (
        <ExecutiveProDashboard
          summary={summary}
          settings={settings}
          parties={parties}
          invoices={invoices}
          items={items}
          expenses={expenses}
          bankAccounts={bankAccounts}
          gstSettings={gstSettings}
          isGstEnabled={isGstEnabled}
          isIndiaCurrency={isIndiaCurrency}
          isUpdatingGst={isUpdatingGst}
          onToggleGst={handleToggleGst}
          onOpenPaySupplier={handleOpenPaySupplier}
          onOpenManageMoney={handleOpenManageMoney}
          onOpenCreditPay={handleOpenDashboardCreditPay}
          onOpenCustomerPay={handleOpenCustomerCreditPay}
          onNavigate={onNavigate}
          onRefresh={async () => {
            await loadData();
            if (onRefresh) await onRefresh();
          }}
          onSwitchToClassic={() => handleSetStyle("classic")}
        />
      ) : (
        <div className="space-y-6 max-w-6xl mx-auto pb-12">
          {/* Top Header & Quick Action Row */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-black/[0.07]">
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[#1D1D1F]">
                  Executive Overview
                </h1>
                <span className="text-[11px] font-semibold text-[#0071E3] bg-[#0071E3]/10 border border-[#0071E3]/20 px-2.5 py-0.5 rounded-full flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-[#0071E3]" />
                  Live Operations
                </span>
              </div>
              <p className="text-xs text-[#86868B] mt-1">
                Real-time liquidity, revenue velocity, inventory valuation, and working capital
              </p>
            </div>

            {/* Action Dock */}
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => handleOpenPaySupplier()}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white hover:bg-neutral-50 text-neutral-800 border border-neutral-200 text-xs font-semibold shadow-2xs transition apple-press cursor-pointer"
              >
                <ArrowUpRight className="w-3.5 h-3.5 text-rose-500 stroke-[2.5]" />
                <span>Pay Supplier</span>
              </button>

              <button
                onClick={() => onNavigate("expenses")}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white hover:bg-neutral-50 text-neutral-800 border border-neutral-200 text-xs font-semibold shadow-2xs transition apple-press cursor-pointer"
              >
                <ArrowDownLeft className="w-3.5 h-3.5 text-amber-500 stroke-[2.5]" />
                <span>Record Expense</span>
              </button>

              <button
                onClick={() => handleOpenManageMoney("deposit")}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-50/70 hover:bg-blue-100/70 text-[#0071E3] border border-[#0071E3]/30 text-xs font-semibold shadow-2xs transition apple-press cursor-pointer"
              >
                <Coins className="w-3.5 h-3.5 stroke-[2.5] text-[#0071E3]" />
                <span>Manage Money</span>
              </button>

              <button
                onClick={() => onNavigate("reports")}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-neutral-200 bg-white hover:bg-neutral-50 text-neutral-800 text-xs font-semibold shadow-2xs transition apple-press cursor-pointer"
              >
                <FileText className="w-3.5 h-3.5 text-neutral-600" />
                <span>Daybook</span>
              </button>

              {/* View Switcher: Pro vs Classic */}
              <div className="flex items-center p-0.5 bg-neutral-100 rounded-xl border border-neutral-200/80 text-xs ml-1">
                <button
                  onClick={() => handleSetStyle("pro")}
                  className="px-2.5 py-1 rounded-lg text-[11px] font-semibold text-neutral-500 hover:text-neutral-900 transition cursor-pointer flex items-center gap-1"
                >
                  <Sparkles className="w-3 h-3 text-[#0071E3]" />
                  Executive
                </button>
                <span className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-white text-neutral-800 shadow-xs">
                  Classic
                </span>
              </div>
            </div>
          </div>

      {/* Indian GST Engine Toggle Switch Card (Active only for INR currency) */}
      {isIndiaCurrency && (
        <div className="p-4 sm:p-5 rounded-3xl bg-gradient-to-r from-[#FFF9F2] to-[#FFFDF9] border border-[#FF9500]/25 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3.5">
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-2xl bg-[#FF9500]/15 text-[#FF9500] flex items-center justify-center shrink-0">
              <Shield className="w-5 h-5 stroke-[2.2]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-xs sm:text-sm font-bold text-[#1D1D1F]">
                  Indian GST & Statutory Accounting Engine
                </h3>
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    isGstEnabled
                      ? "bg-[#34C759]/15 text-[#34C759]"
                      : "bg-black/[0.06] text-[#86868B]"
                  }`}
                >
                  {isGstEnabled ? "ENABLED" : "DISABLED"}
                </span>
              </div>
              <p className="text-[11px] text-[#86868B] mt-0.5">
                Rule 46 CGST/SGST/IGST tax invoices, HSN codes, and Standard Accounting XML export
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 self-end sm:self-auto">
            <span className="text-xs font-semibold text-[#1D1D1F]">
              GST Engine:
            </span>
            <button
              type="button"
              disabled={isUpdatingGst}
              onClick={() => handleToggleGst(!isGstEnabled)}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                isGstEnabled ? "bg-[#34C759]" : "bg-black/[0.15]"
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                  isGstEnabled ? "translate-x-5" : "translate-x-0"
                }`}
              />
            </button>
          </div>
        </div>
      )}

      {/* Customer Credit Reminder Alert Banner */}
      {(debtorCustomers.length > 0 || creditInvoicesByAge.length > 0) && (
        <div className="p-4 sm:p-4.5 rounded-2xl bg-gradient-to-r from-[#FFF5F5] to-[#FFFBFB] border border-[#FF3B30]/25 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#FF3B30]/10 text-[#FF3B30] flex items-center justify-center shrink-0">
              <AlertTriangle className="w-4 h-4 stroke-[2.5]" />
            </div>
            <div>
              <div className="text-xs font-bold text-[#1D1D1F] flex items-center gap-2">
                <span>Customer Credit Reminder</span>
                <span className="px-2 py-0.5 rounded-md bg-[#FF3B30]/10 text-[#FF3B30] text-[10px] font-bold">
                  {debtorCustomers.length} Debtor{debtorCustomers.length !== 1 ? "s" : ""}
                </span>
              </div>
              <div className="text-[11px] text-[#86868B] mt-0.5">
                Total outstanding credit of{" "}
                <span className="font-mono font-bold text-[#FF3B30]">
                  {formatCurrency(totalOutstandingCustomerCredit || summary?.total_receivables || 0)}
                </span>{" "}
                pending collection across customer ledgers.
              </div>
            </div>
          </div>

          <button
            onClick={() => {
              const el = document.getElementById("credit-ledger-section");
              if (el) el.scrollIntoView({ behavior: "auto" });
            }}
            className="px-3.5 py-1.5 rounded-xl bg-[#FF3B30] hover:bg-[#E02E24] text-white text-xs font-semibold shrink-0 transition apple-press cursor-pointer self-start sm:self-auto"
          >
            Review Debtors
          </button>
        </div>
      )}

      {/* Primary KPI Highlights (Enhanced Apple Luxury Cards) */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5 sm:gap-4">
        
        {/* KPI 1: Total Net Sales */}
        <div className="apple-card p-4 sm:p-5 rounded-2xl apple-card-hover relative overflow-hidden group">
          <div className="absolute top-0 left-0 right-0 h-1 bg-[#0071E3]" />
          <div className="flex items-center justify-between text-[#86868B] text-xs font-medium mb-1.5">
            <span>Total Net Sales</span>
            <div className="w-7 h-7 rounded-full bg-blue-50 text-[#0071E3] flex items-center justify-center border border-blue-100">
              <TrendingUp className="w-4 h-4 stroke-[2.5]" />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-bold font-mono text-[#1D1D1F] tracking-tight">
            {formatCurrency(summary?.total_sales ?? 0)}
          </div>
          <div className="flex items-center justify-between text-[11px] text-[#86868B] mt-2 pt-2 border-t border-black/[0.05]">
            <span className="flex items-center gap-1 text-[#0071E3] font-semibold">
              <Receipt className="w-3 h-3" />
              {summary?.sales_count ?? 0} settled
            </span>
            <span className="font-mono text-[#6E6E73]">
              Avg {formatCurrency(summary?.sales_count ? ((summary.total_sales) / summary.sales_count) : 0)}
            </span>
          </div>
        </div>

        {/* KPI 2: Physical Cash Drawer */}
        <div className="apple-card p-4 sm:p-5 rounded-2xl apple-card-hover relative overflow-hidden group">
          <div className="absolute top-0 left-0 right-0 h-1 bg-emerald-600" />
          <div className="flex items-center justify-between text-[#86868B] text-xs font-medium mb-1.5">
            <span>Register Drawer</span>
            <div className="w-7 h-7 rounded-full bg-emerald-50 text-emerald-700 flex items-center justify-center border border-emerald-200/50">
              <Wallet className="w-4 h-4 stroke-[2.5]" />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-bold font-mono text-[#1D1D1F] tracking-tight">
            {formatCurrency(summary?.cash_in_hand ?? 0)}
          </div>
          <div className="flex items-center justify-between text-[11px] mt-2 pt-2 border-t border-black/[0.05]">
            <span className="text-emerald-700 font-semibold flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
              Physical cash float
            </span>
            <button
              onClick={() => handleOpenManageMoney("deposit", "CASH")}
              className="text-[#0071E3] font-semibold hover:underline cursor-pointer"
            >
              Deposit
            </button>
          </div>
        </div>

        {/* KPI 3: Bank Liquidity */}
        <div className="apple-card p-4 sm:p-5 rounded-2xl apple-card-hover relative overflow-hidden group">
          <div className="absolute top-0 left-0 right-0 h-1 bg-sky-500" />
          <div className="flex items-center justify-between text-[#86868B] text-xs font-medium mb-1.5">
            <span>Bank Liquidity</span>
            <div className="w-7 h-7 rounded-full bg-sky-50 text-sky-600 flex items-center justify-center border border-sky-100">
              <Landmark className="w-4 h-4 stroke-[2.5]" />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-bold font-mono text-[#1D1D1F] tracking-tight">
            {formatCurrency(summary?.cash_in_bank ?? 0)}
          </div>
          <div className="flex items-center justify-between text-[11px] text-[#86868B] mt-2 pt-2 border-t border-black/[0.05]">
            <span className="text-sky-600 font-semibold flex items-center gap-1">
              <Building2 className="w-3 h-3" />
              {bankAccounts.length} connected
            </span>
            <button
              onClick={() => handleOpenManageMoney("transfer")}
              className="text-[#0071E3] hover:underline cursor-pointer font-semibold"
            >
              Transfer
            </button>
          </div>
        </div>

        {/* KPI 4: Stock Valuation */}
        <div className="apple-card p-4 sm:p-5 rounded-2xl apple-card-hover relative overflow-hidden group">
          <div className="absolute top-0 left-0 right-0 h-1 bg-[#0071E3]" />
          <div className="flex items-center justify-between text-[#86868B] text-xs font-medium mb-1.5">
            <span>Stock Valuation</span>
            <div className="w-7 h-7 rounded-full bg-blue-50 text-[#0071E3] flex items-center justify-center border border-blue-100">
              <Boxes className="w-4 h-4 stroke-[2.5]" />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-bold font-mono text-[#1D1D1F] tracking-tight">
            {formatCurrency(summary?.total_stock_value ?? 0)}
          </div>
          <div className="flex items-center justify-between text-[11px] mt-2 pt-2 border-t border-black/[0.05]">
            {(summary?.low_stock_count ?? 0) > 0 ? (
              <span className="text-[#FF9500] font-semibold flex items-center gap-1">
                <AlertTriangle className="w-3 h-3 stroke-[2.5]" />
                {summary?.low_stock_count} low alerts
              </span>
            ) : (
              <span className="text-emerald-700 font-semibold flex items-center gap-1">
                <PackageCheck className="w-3 h-3" />
                Catalog optimal
              </span>
            )}
            <button
              onClick={() => onNavigate("inventory")}
              className="text-[#0071E3] hover:underline cursor-pointer font-semibold"
            >
              Manage
            </button>
          </div>
        </div>
      </div>

      {/* Section 2: Visual 7-Day Performance & Category Split */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
        
        {/* Left (2 cols): 7-Day Sales Velocity Bar Chart */}
        <div className="lg:col-span-2 apple-card p-5 sm:p-6 rounded-3xl space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-blue-50 text-[#0071E3] flex items-center justify-center border border-blue-100">
                <TrendingUp className="w-4 h-4 stroke-[2.5]" />
              </div>
              <div>
                <h3 className="text-sm sm:text-base font-bold text-[#1D1D1F]">
                  7-Day Sales Velocity
                </h3>
                <p className="text-[11px] text-[#86868B]">
                  Daily settled gross revenue trajectory
                </p>
              </div>
            </div>

            <div className="text-right">
              <span className="text-xs text-[#86868B]">7-Day Volume:</span>
              <div className="text-sm font-bold font-mono text-[#0071E3]">
                {formatCurrency(total7DaySales)}
              </div>
            </div>
          </div>

          {/* Interactive CSS Bar Chart */}
          <div className="pt-4 pb-2">
            <div className="h-44 flex items-end justify-between gap-2 sm:gap-3 px-2 border-b border-black/[0.06]">
              {last7Days.map((d, idx) => {
                const heightPercent = Math.max(12, Math.round((d.daySales / maxDaySales) * 100));
                const isToday = idx === 6;

                return (
                  <div key={d.dateStr} className="flex-1 flex flex-col items-center h-full justify-end group cursor-pointer">
                    {/* Tooltip on hover */}
                    <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-150 mb-1 text-[10px] font-mono font-bold text-white bg-black/90 px-1.5 py-0.5 rounded shadow-sm whitespace-nowrap pointer-events-none z-10">
                      {formatCurrency(d.daySales)}
                    </div>

                    {/* Bar */}
                    <div
                      style={{ height: `${heightPercent}%` }}
                      className={`w-full max-w-[42px] rounded-t-xl transition-all duration-300 relative group-hover:brightness-105 ${
                        isToday
                          ? "bg-[#0071E3] shadow-xs"
                          : d.daySales > avgDailySales
                          ? "bg-blue-500"
                          : "bg-blue-200"
                      }`}
                    >
                      {isToday && (
                        <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-2 h-2 rounded-full bg-[#0071E3] ring-4 ring-white" />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* X-Axis Labels */}
            <div className="flex justify-between gap-2 sm:gap-3 px-2 pt-2 text-[11px] text-[#86868B] font-medium">
              {last7Days.map((d, idx) => (
                <div key={d.dateStr} className="flex-1 text-center">
                  <span className={idx === 6 ? "font-bold text-[#0071E3]" : ""}>
                    {d.dayName}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between text-xs pt-2 border-t border-black/[0.05]">
            <div className="flex items-center gap-4 text-[#86868B]">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm bg-[#0071E3]" /> Today
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm bg-blue-500" /> Above Avg
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm bg-blue-200" /> Base
              </span>
            </div>
            <span className="text-[#86868B] font-mono text-[11px]">
              Daily Avg: {formatCurrency(avgDailySales)}
            </span>
          </div>
        </div>

        {/* Right (1 col): Category Distribution */}
        <div className="apple-card p-5 sm:p-6 rounded-3xl space-y-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <div className="w-8 h-8 rounded-xl bg-[#AF52DE]/10 text-[#AF52DE] flex items-center justify-center">
                <PieChart className="w-4 h-4 stroke-[2.5]" />
              </div>
              <div>
                <h3 className="text-sm sm:text-base font-bold text-[#1D1D1F]">
                  Category Spread
                </h3>
                <p className="text-[11px] text-[#86868B]">
                  Catalog asset distribution
                </p>
              </div>
            </div>

            {/* Multi-segmented color progress bar */}
            <div className="h-3 w-full bg-[#E5E5EA] rounded-full overflow-hidden flex my-4">
              {categoryStats.map((c) => {
                const widthPercent = Math.max(5, (c.totalValue / totalCategoryValuation) * 100);
                return (
                  <div
                    key={c.category}
                    style={{ width: `${widthPercent}%` }}
                    className={`${c.color.bg} transition-all duration-300`}
                    title={`${c.category}: ${formatCurrency(c.totalValue)}`}
                  />
                );
              })}
            </div>

            {/* Category breakdown rows */}
            <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
              {categoryStats.map((c) => {
                const percent = Math.round((c.totalValue / totalCategoryValuation) * 100);
                return (
                  <div key={c.category} className="flex items-center justify-between text-xs p-2 rounded-xl hover:bg-[#F5F5F7] transition">
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${c.color.bg}`} />
                      <span className="font-semibold text-[#1D1D1F]">{c.category}</span>
                      <span className="text-[10px] text-[#86868B]">({c.itemCount} items)</span>
                    </div>
                    <div className="text-right">
                      <span className="font-mono font-medium text-[#1D1D1F]">
                        {formatCurrency(c.totalValue)}
                      </span>
                      <span className="text-[10px] text-[#86868B] ml-1.5 font-mono">
                        {percent}%
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <button
            onClick={() => onNavigate("inventory")}
            className="w-full py-2 rounded-xl border border-black/[0.08] hover:bg-[#F5F5F7] text-[#1D1D1F] text-xs font-semibold flex items-center justify-center gap-1.5 transition apple-press"
          >
            <Boxes className="w-3.5 h-3.5 text-[#FF9500]" />
            <span>Manage Inventory Catalog</span>
          </button>
        </div>
      </div>

      {/* Section 3: Top Best-Selling Products & Live Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        
        {/* Top 5 Products Leaderboard */}
        <div className="apple-card p-5 sm:p-6 rounded-3xl space-y-3.5">
          <div className="flex items-center justify-between border-b border-black/[0.06] pb-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-[#FF9500]/10 text-[#FF9500] flex items-center justify-center">
                <ShoppingBag className="w-4 h-4 stroke-[2.5]" />
              </div>
              <div>
                <h3 className="text-sm sm:text-base font-bold text-[#1D1D1F]">
                  Top Catalog Products
                </h3>
                <p className="text-[11px] text-[#86868B]">
                  High velocity inventory items
                </p>
              </div>
            </div>

            <button
              onClick={() => onNavigate("inventory")}
              className="text-xs font-semibold text-[#0071E3] hover:underline cursor-pointer"
            >
              View All
            </button>
          </div>

          <div className="divide-y divide-black/[0.04]">
            {topProducts.map((p, idx) => {
              const rankIcons = ["🥇", "🥈", "🥉", "4", "5"];
              const isLowStock = p.stock_quantity <= p.min_stock_alert;

              return (
                <div key={p.id} className="py-2.5 flex items-center justify-between gap-3 hover:bg-[#F5F5F7] px-2 rounded-xl transition">
                  <div className="flex items-center gap-3">
                    <span className="w-6 text-center text-xs font-bold text-[#86868B]">
                      {rankIcons[idx] || idx + 1}
                    </span>
                    <div>
                      <div className="font-semibold text-xs text-[#1D1D1F] line-clamp-1">
                        {p.name}
                      </div>
                      <div className="text-[10px] text-[#86868B] flex items-center gap-2 mt-0.5">
                        <span className="px-1.5 py-0.2 rounded bg-black/[0.04] font-medium">
                          {p.category}
                        </span>
                        <span className="font-mono">
                          {p.stock_quantity} {p.unit} remaining
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <div className="font-mono font-bold text-xs text-[#1D1D1F]">
                      {formatCurrency(p.sale_price)}
                    </div>
                    <span className={`text-[10px] font-semibold ${isLowStock ? "text-amber-700" : "text-emerald-700"}`}>
                      {isLowStock ? "Low Stock" : "In Stock"}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Live Recent Transactions Activity Feed */}
        <div className="apple-card p-5 sm:p-6 rounded-3xl space-y-3.5">
          <div className="flex items-center justify-between border-b border-black/[0.06] pb-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center border border-emerald-200/50">
                <Receipt className="w-4 h-4 stroke-[2.5]" />
              </div>
              <div>
                <h3 className="text-sm sm:text-base font-bold text-[#1D1D1F]">
                  Recent Transactions
                </h3>
                <p className="text-[11px] text-[#86868B]">
                  Latest customer counter settlements
                </p>
              </div>
            </div>

            <button
              onClick={() => onNavigate("invoices")}
              className="text-xs font-semibold text-[#0071E3] hover:underline cursor-pointer"
            >
              All Invoices
            </button>
          </div>

          <div className="divide-y divide-black/[0.04]">
            {recentSales.map((inv) => (
              <div key={inv.id} className="py-2.5 flex items-center justify-between gap-3 hover:bg-[#F5F5F7] px-2 rounded-xl transition">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-black/[0.03] text-[#1D1D1F] flex items-center justify-center font-mono text-[11px] font-bold shrink-0">
                    #{inv.invoice_number.slice(-3)}
                  </div>
                  <div>
                    <div className="font-semibold text-xs text-[#1D1D1F] line-clamp-1">
                      {inv.party_name || "Walk-in Customer"}
                    </div>
                    <div className="text-[10px] text-[#86868B] flex items-center gap-2 mt-0.5">
                      <span>{inv.invoice_date}</span>
                      <span>·</span>
                      <span className="font-medium text-[#1D1D1F]">{inv.payment_method}</span>
                    </div>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <div className="font-mono font-bold text-xs text-black">
                    +{formatCurrency(inv.total_amount)}
                  </div>
                  <span className="text-[10px] font-semibold text-emerald-700">
                    {inv.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Customer Credit & Outstanding Ledger Card */}
      <div id="credit-ledger-section" className="apple-card p-5 sm:p-6 rounded-3xl space-y-4 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-black/[0.06] pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[#FF9500]/10 text-[#FF9500] flex items-center justify-center">
              <Users className="w-4 h-4 stroke-[2.5]" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-bold text-[#1D1D1F]">
                Customer Credit & Outstanding Ledger
              </h3>
              <p className="text-[11px] text-[#86868B]">
                Receivables aging and prioritized debtor collection rankings
              </p>
            </div>
          </div>

          {/* Two ranking tabs */}
          <div className="flex items-center p-0.5 bg-[#F5F5F7] rounded-xl border border-black/[0.06] text-xs">
            <button
              onClick={() => setCreditRankingMode("amount")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                creditRankingMode === "amount"
                  ? "bg-white text-[#0071E3] font-bold shadow-xs"
                  : "text-[#86868B] hover:text-[#1D1D1F]"
              }`}
            >
              Ranked by Credit Amount
            </button>
            <button
              onClick={() => setCreditRankingMode("age")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                creditRankingMode === "age"
                  ? "bg-white text-[#0071E3] font-bold shadow-xs"
                  : "text-[#86868B] hover:text-[#1D1D1F]"
              }`}
            >
              Ranked by Age (Oldest to New)
            </button>
          </div>
        </div>

        {/* TAB 1: Ranked by Credit Amount (#1 to endless) */}
        {creditRankingMode === "amount" && (
          <div className="space-y-2">
            {debtorCustomers.length === 0 ? (
              <div className="py-8 text-center text-xs text-[#86868B]">
                No outstanding customer credits. All accounts are settled!
              </div>
            ) : (
              <div className="divide-y divide-black/[0.04]">
                {debtorCustomers.map((cust, idx) => {
                  const rank = idx + 1;
                  const rankBadge =
                    rank === 1
                      ? "bg-amber-400 text-amber-950 font-black shadow-xs ring-1 ring-amber-300"
                      : rank === 2
                      ? "bg-slate-300 text-slate-800 font-bold"
                      : rank === 3
                      ? "bg-amber-600/20 text-amber-800 font-bold"
                      : "bg-black/[0.05] text-[#86868B] font-semibold";

                  const openInvs = invoices.filter(
                    (i) =>
                      i.party_id === cust.id &&
                      i.invoice_type === "SALE" &&
                      (i.status as string) !== "RETURNED" &&
                      (i.status as string) !== "CANCELLED" &&
                      (i.total_amount - (i.paid_amount || 0)) > 0.009
                  );

                  return (
                    <div
                      key={cust.id}
                      className="py-3 flex items-center justify-between gap-3 hover:bg-[#F5F5F7] px-2.5 rounded-2xl transition"
                    >
                      <div className="flex items-center gap-3">
                        <span
                          className={`w-7 h-7 rounded-xl flex items-center justify-center text-xs shrink-0 ${rankBadge}`}
                        >
                          #{rank}
                        </span>
                        <div>
                          <div className="font-bold text-xs text-[#1D1D1F] flex items-center gap-2">
                            <span>{cust.name}</span>
                            {cust.phone && (
                              <span className="text-[10px] text-[#86868B] font-normal">
                                ({cust.phone})
                              </span>
                            )}
                          </div>
                          <div className="text-[10px] text-[#86868B] mt-0.5 flex items-center gap-2">
                            <span>{openInvs.length} open bill{openInvs.length !== 1 ? "s" : ""}</span>
                            {cust.email && <span>· {cust.email}</span>}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 text-right">
                        <div>
                          <div className="font-mono font-bold text-xs text-[#FF3B30]">
                            {formatCurrency(cust.current_balance)}
                          </div>
                          <span className="text-[10px] font-semibold text-[#FF9500]">
                            Credit Due
                          </span>
                        </div>

                        {openInvs.length > 0 ? (
                          <button
                            onClick={() => handleOpenDashboardCreditPay(openInvs[0])}
                            className="px-2.5 py-1 rounded-lg bg-[#0071E3] hover:bg-blue-700 text-white text-[11px] font-bold shadow-xs transition apple-press cursor-pointer"
                          >
                            Pay
                          </button>
                        ) : (
                          <button
                            onClick={() => handleOpenCustomerCreditPay(cust)}
                            className="px-2.5 py-1 rounded-lg bg-[#0071E3] hover:bg-blue-700 text-white text-[11px] font-bold shadow-xs transition apple-press cursor-pointer"
                          >
                            Pay
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* TAB 2: Ranked by Age (Oldest to New) */}
        {creditRankingMode === "age" && (
          <div className="space-y-2">
            {creditInvoicesByAge.length === 0 ? (
              <div className="py-8 text-center text-xs text-[#86868B]">
                No overdue or credit sale records found.
              </div>
            ) : (
              <div className="divide-y divide-black/[0.04]">
                {creditInvoicesByAge.map((inv) => {
                  const due = Math.max(0, inv.total_amount - (inv.paid_amount || 0));
                  const daysAgo = Math.floor(
                    (new Date().getTime() - new Date(inv.invoice_date).getTime()) / (1000 * 60 * 60 * 24)
                  );

                  return (
                    <div
                      key={inv.id}
                      className="py-3 flex items-center justify-between gap-3 hover:bg-[#F5F5F7] px-2.5 rounded-2xl transition"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-xl bg-[#FF9500]/10 text-[#FF9500] flex items-center justify-center shrink-0">
                          <Clock className="w-4 h-4 stroke-[2.2]" />
                        </div>
                        <div>
                          <div className="font-bold text-xs text-[#1D1D1F] flex items-center gap-2">
                            <span className="font-mono">#{inv.invoice_number}</span>
                            <span className="text-[#86868B] font-normal">·</span>
                            <span>{inv.party_name || "Customer"}</span>
                          </div>
                          <div className="text-[10px] text-[#86868B] mt-0.5 flex items-center gap-2">
                            <span>Date: {inv.invoice_date}</span>
                            <span className="px-1.5 py-0.2 rounded bg-black/[0.04] font-semibold text-[#FF3B30]">
                              {daysAgo <= 0 ? "Today" : `${daysAgo} day${daysAgo > 1 ? "s" : ""} aged`}
                            </span>
                            <span>·</span>
                            <span className="font-medium text-[#1D1D1F]">{inv.payment_method}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 text-right">
                        <div>
                          <div className="font-mono font-bold text-xs text-[#FF3B30]">
                            Due: {formatCurrency(due)}
                          </div>
                          <span className="text-[10px] text-[#86868B] font-mono">
                            Total: {formatCurrency(inv.total_amount)}
                          </span>
                        </div>

                        <button
                          onClick={() => handleOpenDashboardCreditPay(inv)}
                          className="px-2.5 py-1 rounded-lg bg-[#0071E3] hover:bg-blue-700 text-white text-[11px] font-bold shadow-xs transition apple-press cursor-pointer"
                        >
                          Pay
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Section 4: Balance Sheet & Capital Position */}
      <div className="apple-card p-5 sm:p-6 rounded-3xl space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-black/[0.06] pb-3">
          <div className="flex items-center gap-2">
            <Scale className="w-4 h-4 text-[#0071E3]" />
            <h2 className="text-sm sm:text-base font-semibold text-[#1D1D1F] tracking-tight">
              Balance Sheet & Working Capital
            </h2>
          </div>
          <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full flex items-center gap-1 self-start sm:self-auto border border-emerald-200/50">
            <ShieldCheck className="w-3.5 h-3.5" />
            Accounting Reconciled
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
          {/* TOTAL ASSETS */}
          <div className="p-4 rounded-2xl bg-[#F5F5F7] border border-black/[0.05] space-y-3">
            <div className="flex items-center justify-between text-xs font-semibold text-[#6E6E73] uppercase tracking-wider">
              <span>Total Assets</span>
              <span className="w-2 h-2 rounded-full bg-emerald-600" />
            </div>
            <div className="text-2xl font-bold font-mono text-[#1D1D1F]">
              {formatCurrency(totalAssets)}
            </div>
            <div className="space-y-1.5 pt-2 border-t border-black/[0.06] text-xs">
              <div className="flex justify-between text-[#6E6E73]">
                <span>Cash Drawer</span>
                <span className="font-mono font-medium text-[#1D1D1F]">
                  {formatCurrency(summary?.cash_in_hand ?? 0)}
                </span>
              </div>
              <div className="flex justify-between text-[#6E6E73]">
                <span>Cash at Bank</span>
                <span className="font-mono font-medium text-[#1D1D1F]">
                  {formatCurrency(summary?.cash_in_bank ?? 0)}
                </span>
              </div>
              <div className="flex justify-between text-[#6E6E73]">
                <span>Receivables (Customers)</span>
                <span className="font-mono font-medium text-amber-700">
                  {formatCurrency(summary?.total_receivables ?? 0)}
                </span>
              </div>
              <div className="flex justify-between text-[#6E6E73]">
                <span>Inventory Cost Value</span>
                <span className="font-mono font-medium text-[#1D1D1F]">
                  {formatCurrency(summary?.total_stock_value ?? 0)}
                </span>
              </div>
            </div>
          </div>

          {/* TOTAL LIABILITIES */}
          <div className="p-4 rounded-2xl bg-[#F5F5F7] border border-black/[0.05] space-y-3">
            <div className="flex items-center justify-between text-xs font-semibold text-[#6E6E73] uppercase tracking-wider">
              <span>Total Liabilities</span>
              <span className="w-2 h-2 rounded-full bg-rose-600" />
            </div>
            <div className="text-2xl font-bold font-mono text-rose-600">
              {formatCurrency(totalLiabilities)}
            </div>
            <div className="space-y-1.5 pt-2 border-t border-black/[0.06] text-xs">
              <div className="flex justify-between text-[#6E6E73]">
                <span>Payables to Suppliers</span>
                <span className="font-mono font-medium text-rose-600">
                  {formatCurrency(summary?.total_payables ?? 0)}
                </span>
              </div>
              <div className="flex justify-between text-[#86868B] pt-1 text-[11px]">
                <span>Settlement Terms</span>
                <span className="font-semibold text-[#1D1D1F]">Net-30 Standard</span>
              </div>
            </div>
          </div>

          {/* NET CAPITAL / EQUITY */}
          <div className="p-4 rounded-2xl bg-white border border-black/[0.08] shadow-xs space-y-3 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between text-xs font-semibold text-[#1D1D1F] uppercase tracking-wider">
                <span>Net Equity / Capital</span>
                <span className="w-2 h-2 rounded-full bg-[#0071E3]" />
              </div>
              <div className="text-2xl font-bold font-mono text-[#0071E3] mt-2">
                {formatCurrency(netWorth)}
              </div>
              <p className="text-[11px] text-[#86868B] mt-2 leading-relaxed">
                Assets minus liabilities. Retained store earnings & active working capital.
              </p>
            </div>

            <button
              onClick={() => onNavigate("reports")}
              className="w-full py-2 rounded-xl bg-blue-50/60 hover:bg-blue-100/60 text-[#0071E3] text-xs font-semibold flex items-center justify-center gap-1 transition apple-press cursor-pointer"
            >
              <span>View Profit & Loss</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Opening Balance & Capital Allocation Breakdown */}
        <div className="pt-4 border-t border-black/[0.06] grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="p-3.5 rounded-2xl bg-[#F5F5F7]/80 border border-black/[0.04] space-y-2">
            <div className="flex items-center justify-between text-xs font-semibold text-[#1D1D1F]">
              <span className="flex items-center gap-1.5">
                <Wallet className="w-3.5 h-3.5 text-emerald-600" />
                Opening Balance Allocation
              </span>
              <span className="font-mono text-xs font-bold text-[#1D1D1F]">
                {formatCurrency(summary?.opening_balance ?? 0)}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-[11px] pt-1 border-t border-black/[0.04]">
              <div className="bg-white p-2 rounded-xl border border-black/[0.04]">
                <span className="text-[#86868B] block">Cash-in-Hand</span>
                <span className="font-mono font-bold text-[#1D1D1F]">
                  {formatCurrency(summary?.opening_cash ?? 0)}
                </span>
              </div>
              <div className="bg-white p-2 rounded-xl border border-black/[0.04]">
                <span className="text-[#86868B] block">Bank Account</span>
                <span className="font-mono font-bold text-[#0071E3]">
                  {formatCurrency(summary?.opening_bank ?? 0)}
                </span>
              </div>
            </div>
          </div>

          <div className="p-3.5 rounded-2xl bg-[#F5F5F7]/80 border border-black/[0.04] space-y-2">
            <div className="flex items-center justify-between text-xs font-semibold text-[#1D1D1F]">
              <span className="flex items-center gap-1.5">
                <Landmark className="w-3.5 h-3.5 text-[#0071E3]" />
                Capital Position Allocation
              </span>
              <span className="font-mono text-xs font-bold text-[#1D1D1F]">
                {formatCurrency(summary?.capital ?? 0)}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-[11px] pt-1 border-t border-black/[0.04]">
              <div className="bg-white p-2 rounded-xl border border-black/[0.04]">
                <span className="text-[#86868B] block">Capital Cash</span>
                <span className="font-mono font-bold text-[#1D1D1F]">
                  {formatCurrency(summary?.capital_cash ?? 0)}
                </span>
              </div>
              <div className="bg-white p-2 rounded-xl border border-black/[0.04]">
                <span className="text-[#86868B] block">Capital Bank</span>
                <span className="font-mono font-bold text-[#0071E3]">
                  {formatCurrency(summary?.capital_bank ?? 0)}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Low Stock Warning Banner if applicable */}
      {(summary?.low_stock_count ?? 0) > 0 && (
        <div className="p-4 rounded-2xl bg-white border border-[#FF9500]/30 shadow-xs flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#FF9500]/10 text-[#FF9500] flex items-center justify-center shrink-0">
              <AlertTriangle className="w-4 h-4 stroke-[2.5]" />
            </div>
            <div>
              <div className="text-xs font-bold text-[#1D1D1F]">
                {summary?.low_stock_count} Items Below Reorder Threshold
              </div>
              <div className="text-[11px] text-[#86868B]">
                Products are running low in stock and may impact ongoing register sales.
              </div>
            </div>
          </div>

          <button
            onClick={() => onNavigate("inventory")}
            className="px-3.5 py-1.5 rounded-xl bg-[#0071E3] hover:bg-[#0077ED] text-white text-xs font-semibold shrink-0 transition apple-press cursor-pointer shadow-xs"
          >
            Review Stock
          </button>
        </div>
      )}
        </div>
      )}

      {/* Pay Supplier Modal */}
      {isPaySupplierOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md border border-black/[0.08] overflow-visible animate-in fade-in zoom-in-95 duration-150 text-black">
            <div className="px-5 py-4 border-b border-black/[0.08] flex items-center justify-between bg-[#F9FAFB] rounded-t-3xl">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-blue-50 text-[#0071E3] flex items-center justify-center border border-blue-100">
                  <ArrowUpRight className="w-4 h-4 stroke-[2.5]" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-black tracking-tight">
                    Settle Supplier
                  </h3>
                  <p className="text-[11px] text-neutral-400">
                    Disburse supplier payment
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsPaySupplierOpen(false)}
                className="w-7 h-7 rounded-full text-neutral-400 hover:text-black hover:bg-black/5 flex items-center justify-center cursor-pointer transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleExecutePaySupplier} className="p-5 space-y-3.5">
              <div>
                <label className="text-[11px] font-semibold text-neutral-700 block mb-1">
                  Supplier *
                </label>
                <AppleSelect
                  value={supplierId}
                  onChange={(val) => {
                    setSupplierId(val);
                    const v = vendors.find((p) => p.id === val);
                    if (v) setSupplierAmount(Math.abs(v.current_balance).toString());
                  }}
                  placeholder="-- Select Supplier --"
                  options={[
                    { value: "", label: "-- Select Supplier --" },
                    ...vendors.map((v) => ({
                      value: v.id,
                      label: `${v.name} (Due: ${formatCurrency(Math.abs(v.current_balance))})`,
                    })),
                  ]}
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-neutral-700 block mb-1">
                  Amount ({currency}) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={supplierAmount}
                  onChange={(e) => setSupplierAmount(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-black/[0.08] bg-white text-xs font-mono font-bold text-black focus:outline-none focus:border-black placeholder:text-neutral-400"
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-neutral-700 block mb-1">
                  Source
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setSupplierMethod("CASH")}
                    className={`py-2 rounded-xl border text-xs font-bold uppercase tracking-wider transition cursor-pointer ${
                      supplierMethod === "CASH"
                        ? "bg-[#0071E3] text-white border-[#0071E3] shadow-xs"
                        : "bg-[#F9FAFB] text-neutral-600 border-black/[0.08] hover:text-black"
                    }`}
                  >
                    Cash Drawer
                  </button>
                  <button
                    type="button"
                    onClick={() => setSupplierMethod("BANK")}
                    className={`py-2 rounded-xl border text-xs font-bold uppercase tracking-wider transition cursor-pointer ${
                      supplierMethod === "BANK"
                        ? "bg-[#0071E3] text-white border-[#0071E3] shadow-xs"
                        : "bg-[#F9FAFB] text-neutral-600 border-black/[0.08] hover:text-black"
                    }`}
                  >
                    Bank
                  </button>
                </div>
              </div>

              {supplierMethod === "BANK" && bankAccounts.length > 0 && (
                <div>
                  <label className="text-[11px] font-semibold text-neutral-700 block mb-1">
                    Debit Bank
                  </label>
                  <AppleSelect
                    value={supplierBankId}
                    onChange={setSupplierBankId}
                    options={bankAccounts.map((b) => ({
                      value: b.id,
                      label: `${b.bank_name} - ${b.account_name} (${formatCurrency(b.current_balance)})`,
                    }))}
                  />
                </div>
              )}

              <div>
                <label className="text-[11px] font-semibold text-neutral-700 block mb-1">
                  Reference
                </label>
                <input
                  type="text"
                  placeholder="Optional reference"
                  value={supplierRef}
                  onChange={(e) => setSupplierRef(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl border border-black/[0.08] bg-white text-xs font-medium text-black focus:outline-none focus:border-black placeholder:text-neutral-400"
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-neutral-700 block mb-1">
                  Note
                </label>
                <input
                  type="text"
                  placeholder="Settlement note"
                  value={supplierNotes}
                  onChange={(e) => setSupplierNotes(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl border border-black/[0.08] bg-white text-xs font-medium text-black focus:outline-none focus:border-black placeholder:text-neutral-400"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsPaySupplierOpen(false)}
                  className="flex-1 py-2.5 rounded-xl border border-black/[0.1] text-xs font-semibold text-neutral-700 bg-white hover:bg-neutral-50 cursor-pointer shadow-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingPay}
                  className="flex-1 py-2.5 rounded-xl bg-[#0071E3] hover:bg-[#0077ED] text-white text-xs font-bold uppercase tracking-wider shadow-xs transition cursor-pointer"
                >
                  {isSubmittingPay ? "Recording..." : "Pay Supplier"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Credit Bill Settlement Modal */}
      {dashboardPayTarget && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md border border-black/[0.08] overflow-hidden animate-in fade-in zoom-in-95 duration-150 text-black">
            {/* Modal Header */}
            <div className="px-5 py-4 border-b border-black/[0.08] flex items-center justify-between bg-[#F9FAFB]">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-blue-50 text-[#0071E3] flex items-center justify-center border border-blue-100">
                  <CurrencyIcon className="w-4 h-4" strokeWidth={2} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-black tracking-tight">
                    Settle Credit
                  </h3>
                  <p className="text-[11px] text-neutral-400">
                    Collect customer payment
                  </p>
                </div>
              </div>
              <button
                onClick={() => setDashboardPayTarget(null)}
                className="w-7 h-7 rounded-full text-neutral-400 hover:text-black hover:bg-black/5 flex items-center justify-center cursor-pointer transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Bill Summary Card */}
            <div className="p-5 space-y-4">
              <div className="p-3.5 rounded-2xl bg-white border border-black/[0.08] space-y-2 text-xs">
                <div className="flex justify-between items-center">
                  <span className="text-neutral-400">Invoice:</span>
                  <span className="font-mono font-bold text-black">
                    #{dashboardPayTarget.invoice_number}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-neutral-400">Customer:</span>
                  <span className="font-semibold text-black">
                    {dashboardPayTarget.party_name || "Walk-in Customer"}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-neutral-400">Total:</span>
                  <span className="font-mono font-semibold text-black">
                    {formatCurrency(dashboardPayTarget.total_amount)}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-neutral-400">Paid:</span>
                  <span className="font-mono font-semibold text-emerald-400">
                    {formatCurrency(dashboardPayTarget.paid_amount || 0)}
                  </span>
                </div>
                <div className="pt-2 border-t border-black/[0.08] flex justify-between items-center">
                  <span className="font-bold text-red-400">Balance Due:</span>
                  <span className="font-mono font-bold text-sm text-red-400">
                    {formatCurrency(
                      Math.max(0, dashboardPayTarget.total_amount - (dashboardPayTarget.paid_amount || 0))
                    )}
                  </span>
                </div>
              </div>

              {/* Custom Money Entry Input with 100% and 50% quick buttons */}
              <div>
                <label className="text-[11px] font-semibold text-neutral-700 block mb-1">
                  Payment Amount *
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-mono font-bold text-neutral-500">
                    {settings.currency_symbol || "$"}
                  </span>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    required
                    value={dashboardPayAmount}
                    onChange={(e) => setDashboardPayAmount(e.target.value)}
                    className="w-full pl-8 pr-3 py-2.5 rounded-xl border border-black/[0.08] bg-white text-sm font-mono font-bold text-black focus:outline-none focus:border-black placeholder:text-neutral-400"
                    placeholder="0.00"
                  />
                </div>

                <div className="flex gap-2 mt-2">
                  <button
                    type="button"
                    onClick={() => {
                      const rem = Math.max(0, dashboardPayTarget.total_amount - (dashboardPayTarget.paid_amount || 0));
                      setDashboardPayAmount(rem.toFixed(2));
                    }}
                    className="flex-1 py-1.5 px-2 rounded-xl bg-blue-50 hover:bg-blue-100 text-[#0071E3] border border-blue-200 text-xs font-bold transition cursor-pointer"
                  >
                    100% Full
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const rem = Math.max(0, dashboardPayTarget.total_amount - (dashboardPayTarget.paid_amount || 0));
                      setDashboardPayAmount((rem / 2).toFixed(2));
                    }}
                    className="flex-1 py-1.5 px-2 rounded-xl bg-[#F9FAFB] hover:bg-neutral-100 text-neutral-700 text-xs font-semibold border border-black/[0.08] transition cursor-pointer"
                  >
                    50% Half
                  </button>
                </div>
              </div>

              {/* Payment Method Selector */}
              <div>
                <label className="text-[11px] font-semibold text-neutral-700 block mb-1">
                  Method
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setDashboardPayMethod("CASH")}
                    className={`py-2 rounded-xl border text-xs font-bold uppercase tracking-wider transition cursor-pointer ${
                      dashboardPayMethod === "CASH"
                        ? "bg-[#0071E3] text-white border-[#0071E3] shadow-xs"
                        : "bg-[#F9FAFB] text-neutral-600 border-black/[0.08] hover:text-black"
                    }`}
                  >
                    Cash
                  </button>
                  <button
                    type="button"
                    onClick={() => setDashboardPayMethod("CARD")}
                    className={`py-2 rounded-xl border text-xs font-bold uppercase tracking-wider transition cursor-pointer ${
                      dashboardPayMethod === "CARD"
                        ? "bg-[#0071E3] text-white border-[#0071E3] shadow-xs"
                        : "bg-[#F9FAFB] text-neutral-600 border-black/[0.08] hover:text-black"
                    }`}
                  >
                    Card
                  </button>
                  <button
                    type="button"
                    onClick={() => setDashboardPayMethod("BANK")}
                    className={`py-2 rounded-xl border text-xs font-bold uppercase tracking-wider transition cursor-pointer ${
                      dashboardPayMethod === "BANK"
                        ? "bg-[#0071E3] text-white border-[#0071E3] shadow-xs"
                        : "bg-[#F9FAFB] text-neutral-600 border-black/[0.08] hover:text-black"
                    }`}
                  >
                    Bank
                  </button>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2 pt-2 border-t border-black/[0.08]">
                <button
                  type="button"
                  onClick={() => setDashboardPayTarget(null)}
                  className="flex-1 py-2.5 rounded-xl border border-black/[0.1] text-xs font-semibold text-neutral-700 bg-white hover:bg-neutral-50 cursor-pointer shadow-xs"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={isSubmittingDashboardPay}
                  onClick={() => handleExecuteDashboardCreditPay()}
                  className="flex-1 py-2.5 rounded-xl bg-[#0071E3] hover:bg-[#0077ED] text-white text-xs font-bold uppercase tracking-wider shadow-xs transition cursor-pointer"
                >
                  {isSubmittingDashboardPay ? "Saving..." : "Confirm Pay"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Unified Manage Money (Deposit / Transfer / Balances) Modal */}
      <ManageMoneyModal
        isOpen={isManageMoneyOpen}
        onClose={() => setIsManageMoneyOpen(false)}
        initialTab={manageMoneyTab}
        initialDepositDestination={manageMoneyDest}
        settings={settings}
        summary={summary}
        onSuccess={() => {
          loadData();
          if (onRefresh) onRefresh();
        }}
      />
    </div>
  );
};
