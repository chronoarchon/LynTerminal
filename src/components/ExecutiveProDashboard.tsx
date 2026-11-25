import React, { useState, useMemo } from "react";
import {
  TrendingUp,
  TrendingDown,
  Wallet,
  Users,
  Receipt,
  ArrowUpRight,
  ArrowDownLeft,
  Sparkles,
  AlertTriangle,
  PackageCheck,
  Coins,
  CheckCircle2,
  ChevronRight,
  ArrowRight,
  Search,
  RefreshCw,
} from "lucide-react";
import type { DashboardSummary, Settings, Party, BankAccount, Invoice, Item, Expense } from "../types";
import { useCurrency } from "../context/CurrencyContext";
import type { GstSettings } from "../modules/india_gst/gstTypes";
import { getLocalDateString, getLocalDateOffset } from "../utils/date";

interface ExecutiveProDashboardProps {
  summary: DashboardSummary | null;
  settings: Settings;
  parties?: Party[];
  invoices: Invoice[];
  items: Item[];
  expenses?: Expense[];
  bankAccounts: BankAccount[];
  gstSettings?: GstSettings | null;
  isGstEnabled: boolean;
  isIndiaCurrency: boolean;
  isUpdatingGst: boolean;
  onToggleGst: (enable: boolean) => void;
  onOpenPaySupplier: (vendor?: Party) => void;
  onOpenManageMoney: (tab?: "deposit" | "transfer" | "manage", dest?: "CASH" | "BANK" | "CAPITAL") => void;
  onOpenCreditPay: (inv: Invoice) => void;
  onOpenCustomerPay: (cust: Party) => void;
  onNavigate: (tab: string) => void;
  onRefresh?: () => void;
  onSwitchToClassic: () => void;
}

type TimeRange = "today" | "7d" | "30d" | "all";

export const ExecutiveProDashboard: React.FC<ExecutiveProDashboardProps> = ({
  summary,
  settings,
  parties = [],
  invoices = [],
  items = [],
  expenses = [],
  bankAccounts = [],
  gstSettings,
  isGstEnabled,
  isIndiaCurrency,
  isUpdatingGst,
  onToggleGst,
  onOpenPaySupplier,
  onOpenManageMoney,
  onOpenCreditPay,
  onOpenCustomerPay,
  onNavigate,
  onRefresh,
  onSwitchToClassic,
}) => {
  const { formatCurrency } = useCurrency();
  const [selectedTimeRange, setSelectedTimeRange] = useState<TimeRange>("all");
  const [transactionFilter, setTransactionFilter] = useState<"ALL" | "CASH" | "CARD" | "CREDIT">("ALL");
  const [rightPanelTab, setRightPanelTab] = useState<"debtors" | "inventory">("debtors");
  const [searchTx, setSearchTx] = useState("");

  const todayStr = getLocalDateString();

  // Compute authentic period metrics directly from real SQLite invoices, expenses, and summary
  const periodMetrics = useMemo(() => {
    const startStr =
      selectedTimeRange === "today"
        ? todayStr
        : selectedTimeRange === "7d"
        ? getLocalDateOffset(6)
        : selectedTimeRange === "30d"
        ? getLocalDateOffset(29)
        : "";

    const prevEndStr =
      selectedTimeRange === "today"
        ? getLocalDateOffset(1)
        : selectedTimeRange === "7d"
        ? getLocalDateOffset(7)
        : selectedTimeRange === "30d"
        ? getLocalDateOffset(30)
        : "";

    const prevStartStr =
      selectedTimeRange === "today"
        ? getLocalDateOffset(1)
        : selectedTimeRange === "7d"
        ? getLocalDateOffset(13)
        : selectedTimeRange === "30d"
        ? getLocalDateOffset(59)
        : "";

    const inRange = (dateStr: string, from: string, to: string) => {
      if (!dateStr) return false;
      const d = dateStr.slice(0, 10);
      if (from && d < from) return false;
      if (to && d > to) return false;
      return true;
    };

    const isActiveInvoice = (inv: Invoice, type: Invoice["invoice_type"]) => {
      const status = String(inv.status || "").toUpperCase();
      return inv.invoice_type === type && status !== "RETURNED" && status !== "CANCELLED";
    };
    const isActiveSale = (inv: Invoice) => isActiveInvoice(inv, "SALE");
    const isActivePurchase = (inv: Invoice) => isActiveInvoice(inv, "PURCHASE");

    // Current selected window
    const periodSaleInvoices =
      selectedTimeRange === "all"
        ? invoices.filter(isActiveSale)
        : invoices.filter((inv) => isActiveSale(inv) && inRange(inv.invoice_date, startStr, todayStr));

    const periodReturns =
      selectedTimeRange === "all"
        ? invoices.filter((inv) => inv.invoice_type === "RETURN")
        : invoices.filter((inv) => inv.invoice_type === "RETURN" && inRange(inv.invoice_date, startStr, todayStr));

    const periodPurchasesInvoices =
      selectedTimeRange === "all"
        ? invoices.filter(isActivePurchase)
        : invoices.filter((inv) => isActivePurchase(inv) && inRange(inv.invoice_date, startStr, todayStr));

    const periodExpenseRows =
      selectedTimeRange === "all"
        ? expenses
        : expenses.filter((exp) => inRange(exp.expense_date, startStr, todayStr));

    // When "all" is active and backend summary exists, use exact Rust reconciled totals
    // (which also account for sales returns, purchase returns table, and staff salaries).
    const grossSales = periodSaleInvoices.reduce((sum, inv) => sum + inv.total_amount, 0);
    const salesReturnsTotal = periodReturns.reduce((sum, inv) => sum + inv.total_amount, 0);
    const computedNetSales = Math.round((grossSales - salesReturnsTotal) * 100) / 100;
    const computedPurchases = Math.round(
      periodPurchasesInvoices.reduce((sum, inv) => sum + inv.total_amount, 0) * 100
    ) / 100;
    const computedExpenses = Math.round(
      periodExpenseRows.reduce((sum, exp) => sum + exp.amount, 0) * 100
    ) / 100;

    const useBackendAllTotals = selectedTimeRange === "all" && summary !== null;
    const revenue = useBackendAllTotals ? summary.total_sales : computedNetSales;
    const orderCount = useBackendAllTotals ? summary.sales_count : periodSaleInvoices.length;
    const purchases = useBackendAllTotals ? summary.total_purchases : computedPurchases;
    const operatingExpenses = useBackendAllTotals ? summary.total_expenses : computedExpenses;
    const netProfit = useBackendAllTotals
      ? summary.net_profit
      : Math.round((revenue - purchases - operatingExpenses) * 100) / 100;

    const totalOutflows = Math.round((purchases + operatingExpenses) * 100) / 100;
    const marginPercent = revenue > 0 ? Math.round((netProfit / revenue) * 100) : 0;
    const avgOrderValue = orderCount > 0 ? revenue / orderCount : 0;

    // Real prior-period comparison % (only computed when a bounded range is selected & prior sales > 0)
    let growthPercent: number | null = null;
    if (selectedTimeRange !== "all" && prevStartStr && prevEndStr) {
      const prevSales = invoices
        .filter((inv) => isActiveSale(inv) && inRange(inv.invoice_date, prevStartStr, prevEndStr))
        .reduce((sum, inv) => sum + inv.total_amount, 0);
      const prevReturns = invoices
        .filter((inv) => inv.invoice_type === "RETURN" && inRange(inv.invoice_date, prevStartStr, prevEndStr))
        .reduce((sum, inv) => sum + inv.total_amount, 0);
      const prevNet = prevSales - prevReturns;
      if (prevNet > 0.01) {
        growthPercent = Math.round(((revenue - prevNet) / prevNet) * 1000) / 10;
      }
    }

    return {
      revenue,
      orderCount,
      purchases,
      operatingExpenses,
      totalOutflows,
      netProfit,
      marginPercent,
      avgOrderValue,
      growthPercent,
      startStr,
    };
  }, [selectedTimeRange, invoices, expenses, summary, todayStr]);

  // Customers with outstanding credit
  const debtorCustomers = useMemo(() => {
    return parties
      .filter((p) => p.party_type === "CUSTOMER" && p.current_balance > 0.009)
      .sort((a, b) => b.current_balance - a.current_balance);
  }, [parties]);

  const totalOutstandingCredit = useMemo(() => {
    return debtorCustomers.reduce((acc, c) => acc + c.current_balance, 0);
  }, [debtorCustomers]);

  // Vendors with payable balance
  const vendorPayables = useMemo(() => {
    return parties
      .filter((p) => p.party_type === "VENDOR" && p.current_balance < -0.009)
      .sort((a, b) => a.current_balance - b.current_balance);
  }, [parties]);

  const totalVendorPayables = useMemo(() => {
    return vendorPayables.reduce((acc, v) => acc + Math.abs(v.current_balance), 0);
  }, [vendorPayables]);

  // Dynamic Chart Series driven by selectedTimeRange (using local calendar dates)
  const chartData = useMemo(() => {
    const activeSales = invoices.filter((inv) => {
      const status = String(inv.status || "").toUpperCase();
      return inv.invoice_type === "SALE" && status !== "RETURNED" && status !== "CANCELLED";
    });

    if (selectedTimeRange === "30d") {
      const buckets = Array.from({ length: 30 }, (_, i) => {
        const d = new Date();
        d.setDate(d.getDate() - (29 - i));
        const key = getLocalDateString(d);
        const dayNum = String(d.getDate());
        const showLabel = i === 0 || i === 7 || i === 14 || i === 21 || i === 29;
        const daySales = activeSales
          .filter((inv) => inv.invoice_date.slice(0, 10) === key)
          .reduce((sum, inv) => sum + inv.total_amount, 0);
        return {
          key,
          label: showLabel ? d.toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "",
          tooltipLabel: `${d.toLocaleDateString("en-US", { month: "short", day: "numeric" })} (${dayNum})`,
          sales: daySales,
          isCurrent: i === 29,
        };
      });
      return {
        title: "30-Day Revenue Velocity",
        subtitle: "Daily settled sales over the last 30 days",
        badge: "30-Day Window",
        volumeLabel: "30-Day Volume",
        avgLabel: "Daily Baseline",
        buckets,
        compact: true,
      };
    }

    if (selectedTimeRange === "all") {
      // Group last 6 months cleanly by YYYY-MM
      const monthBuckets = Array.from({ length: 6 }, (_, i) => {
        const d = new Date();
        d.setDate(1);
        d.setMonth(d.getMonth() - (5 - i));
        const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        const label = d.toLocaleDateString("en-US", { month: "short", year: "2-digit" });
        const monthSales = activeSales
          .filter((inv) => inv.invoice_date.slice(0, 7) === ym)
          .reduce((sum, inv) => sum + inv.total_amount, 0);
        return {
          key: ym,
          label,
          tooltipLabel: label,
          sales: monthSales,
          isCurrent: i === 5,
        };
      });
      return {
        title: "Monthly Revenue Trajectory",
        subtitle: "Settled counter receipts across the last 6 months",
        badge: "6-Month Ledger",
        volumeLabel: "6-Month Volume",
        avgLabel: "Monthly Avg",
        buckets: monthBuckets,
        compact: false,
      };
    }

    // "today" or "7d": 7-day rolling local window
    const dayBuckets = Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (6 - i));
      const key = getLocalDateString(d);
      const dayName = d.toLocaleDateString("en-US", { weekday: "short" });
      const daySales = activeSales
        .filter((inv) => inv.invoice_date.slice(0, 10) === key)
        .reduce((sum, inv) => sum + inv.total_amount, 0);
      return {
        key,
        label: dayName,
        tooltipLabel: `${dayName} (${key})`,
        sales: daySales,
        isCurrent: i === 6,
      };
    });

    return {
      title: "7-Day Revenue Trajectory",
      subtitle: "Daily settled receipts across Cash, Card, UPI, and Credit sales",
      badge: "7-Day Rolling Window",
      volumeLabel: "Weekly Volume",
      avgLabel: "Daily Baseline",
      buckets: dayBuckets,
      compact: false,
    };
  }, [invoices, selectedTimeRange]);

  const maxChartSales = Math.max(...chartData.buckets.map((b) => b.sales), 1);
  const totalChartVolume = chartData.buckets.reduce((sum, b) => sum + b.sales, 0);
  const avgChartVolume = chartData.buckets.length > 0 ? totalChartVolume / chartData.buckets.length : 0;

  // Recent sales filtered by active search, payment type, and period
  const recentSales = useMemo(() => {
    return invoices
      .filter((inv) => inv.invoice_type === "SALE")
      .filter((inv) => {
        if (selectedTimeRange === "all") return true;
        return inv.invoice_date.slice(0, 10) >= periodMetrics.startStr;
      })
      .filter((inv) => {
        if (transactionFilter === "ALL") return true;
        const pm = inv.payment_method?.toUpperCase() || "";
        if (transactionFilter === "CASH") return pm.includes("CASH");
        if (transactionFilter === "CARD") return pm.includes("CARD") || pm.includes("TRANSFER") || pm.includes("UPI");
        if (transactionFilter === "CREDIT") return inv.status === "CREDIT" || inv.status === "PARTIAL" || inv.status === "UNPAID" || pm.includes("CREDIT");
        return true;
      })
      .filter((inv) => {
        if (!searchTx.trim()) return true;
        const q = searchTx.toLowerCase();
        return (
          inv.invoice_number.toLowerCase().includes(q) ||
          (inv.party_name && inv.party_name.toLowerCase().includes(q))
        );
      })
      .slice(0, 10);
  }, [invoices, transactionFilter, searchTx, selectedTimeRange, periodMetrics.startStr]);

  // Low-stock items
  const lowStockItems = useMemo(() => {
    return items
      .filter((it) => it.stock_quantity <= it.min_stock_alert)
      .sort((a, b) => (a.stock_quantity / Math.max(1, a.min_stock_alert)) - (b.stock_quantity / Math.max(1, b.min_stock_alert)));
  }, [items]);

  // Reconciled Cost Stock Valuation matching Rust backend (stock_quantity * purchase_price)
  const computedCostStockValuation = useMemo(() => {
    return items
      .filter((it) => it.stock_quantity > 0)
      .reduce((sum, it) => sum + it.stock_quantity * it.purchase_price, 0);
  }, [items]);

  // Authentic balance sheet values (NEVER hardcoded mock fallbacks!)
  const cashInHand = summary?.cash_in_hand ?? 0;
  const cashInBank = summary?.cash_in_bank ?? 0;
  const totalLiquid = cashInHand + cashInBank;
  const totalReceivables = summary?.total_receivables ?? totalOutstandingCredit;
  const totalStockValuation = summary?.total_stock_value ?? computedCostStockValuation;
  const totalAssets = summary?.total_assets ?? (totalLiquid + totalStockValuation + totalReceivables);
  const totalLiabilities = summary?.total_liabilities ?? (summary?.total_payables ?? totalVendorPayables);
  const netWorth = summary?.net_worth ?? (totalAssets - totalLiabilities);

  // Solvency status badge computed from real numbers
  const solvencyStatus =
    totalAssets === 0 && totalLiabilities === 0
      ? { label: "Fresh Ledger", cls: "text-neutral-600 bg-neutral-100 border-neutral-200" }
      : netWorth < 0
      ? { label: "Negative Equity", cls: "text-rose-700 bg-rose-50 border-rose-200" }
      : totalLiabilities > totalAssets * 0.6
      ? { label: "Elevated Debt", cls: "text-amber-700 bg-amber-50 border-amber-200" }
      : { label: "Healthy Solvency", cls: "text-emerald-700 bg-emerald-50 border-emerald-200/60" };

  const revenueTitle =
    selectedTimeRange === "today"
      ? "Today's Revenue"
      : selectedTimeRange === "7d"
      ? "7-Day Revenue"
      : selectedTimeRange === "30d"
      ? "30-Day Revenue"
      : "Total Net Revenue";

  const profitTitle =
    selectedTimeRange === "today"
      ? "Today's Net Profit"
      : selectedTimeRange === "7d"
      ? "7-Day Net Profit"
      : selectedTimeRange === "30d"
      ? "30-Day Net Profit"
      : "Net Operating Profit";

  return (
    <div className="space-y-6 max-w-7xl mx-auto select-none pb-14 text-[#1D1D1F]">
      
      {/* =========================================================================
          1. EXECUTIVE COMMAND HEADER
      ========================================================================== */}
      <div className="bg-white rounded-3xl p-5 sm:p-6 border border-black/[0.07] shadow-[0_1px_3px_rgba(0,0,0,0.02)]">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
          
          {/* Business Entity Title & Live Indicators */}
          <div>
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[#1D1D1F]">
                {settings.business_name || "Enterprise Operations"}
              </h1>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/60">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Live Terminal
              </span>
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-neutral-100 text-neutral-600 border border-neutral-200/60 font-mono">
                SQLite WAL Offline
              </span>
            </div>
          </div>

          {/* Quick Actions & Time Range Switcher */}
          <div className="flex flex-wrap items-center gap-2.5">
            
            {/* Real Time Horizon Selector */}
            <div className="flex items-center p-0.5 bg-neutral-100 rounded-xl border border-neutral-200/80 text-xs mr-1">
              {(["today", "7d", "30d", "all"] as const).map((r) => (
                <button
                  key={r}
                  onClick={() => setSelectedTimeRange(r)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition cursor-pointer ${
                    selectedTimeRange === r
                      ? "bg-white text-neutral-900 font-bold shadow-xs"
                      : "text-neutral-500 hover:text-neutral-800"
                  }`}
                >
                  {r === "today" ? "Today" : r === "7d" ? "7D" : r === "30d" ? "30D" : "All"}
                </button>
              ))}
            </div>

            {/* Primary Action: POS Sale */}
            <button
              onClick={() => onNavigate("pos")}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#0071E3] hover:bg-[#0077ED] text-white text-xs font-semibold shadow-sm transition apple-press cursor-pointer"
            >
              <Receipt className="w-3.5 h-3.5" />
              <span>New POS Sale</span>
              <kbd className="px-1.5 py-0.5 text-[10px] bg-white/20 rounded font-mono font-normal">F2</kbd>
            </button>

            {/* Pay Supplier */}
            <button
              onClick={() => onOpenPaySupplier()}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-neutral-50 hover:bg-neutral-100 text-neutral-800 border border-neutral-200/80 text-xs font-semibold shadow-2xs transition apple-press cursor-pointer"
            >
              <ArrowUpRight className="w-3.5 h-3.5 text-rose-500" strokeWidth={2.2} />
              <span>Pay Vendor</span>
            </button>

            {/* Record Expense */}
            <button
              onClick={() => onNavigate("expenses")}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-neutral-50 hover:bg-neutral-100 text-neutral-800 border border-neutral-200/80 text-xs font-semibold shadow-2xs transition apple-press cursor-pointer"
            >
              <ArrowDownLeft className="w-3.5 h-3.5 text-amber-500" strokeWidth={2.2} />
              <span>Record Expense</span>
            </button>

            {/* Manage Treasury / Cash Float */}
            <button
              onClick={() => onOpenManageMoney("deposit")}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-neutral-50 hover:bg-neutral-100 text-neutral-800 border border-neutral-200/80 text-xs font-semibold shadow-2xs transition apple-press cursor-pointer"
            >
              <Coins className="w-3.5 h-3.5 text-blue-600" strokeWidth={2} />
              <span>Treasury</span>
            </button>

            {/* View Switcher: Pro vs Classic */}
            <div className="flex items-center p-0.5 bg-neutral-100 rounded-xl border border-neutral-200/80 text-xs ml-1">
              <span className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-white text-[#0071E3] shadow-xs flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-[#0071E3]" />
                Executive
              </span>
              <button
                onClick={onSwitchToClassic}
                className="px-2.5 py-1 rounded-lg text-[11px] font-semibold text-neutral-500 hover:text-neutral-900 transition cursor-pointer"
                title="Switch back to Classic Dashboard"
              >
                Classic
              </button>
            </div>

            {/* Refresh */}
            {onRefresh && (
              <button
                onClick={onRefresh}
                className="p-2 rounded-xl hover:bg-neutral-100 text-neutral-500 hover:text-neutral-800 transition cursor-pointer"
                title="Refresh metrics"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Indian GST Compliance Banner (If INR currency) */}
        {isIndiaCurrency && (
          <div className="mt-4 pt-3.5 border-t border-neutral-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-amber-50 text-amber-700 border border-amber-200/60 flex items-center justify-center font-bold text-[11px]">
                GST
              </div>
              <div>
                <span className="font-semibold text-neutral-800">
                  Indian GST Statutory Engine
                </span>
                {gstSettings?.gstin && gstSettings.gstin !== "27AABCU9603R1ZN" && gstSettings.gstin !== "27AABCU9603R1ZM" ? (
                  <span className="text-neutral-500 font-mono text-[11px] ml-1.5">
                    · GSTIN {gstSettings.gstin}
                  </span>
                ) : (
                  <span className="text-neutral-500 text-[11px] ml-1.5">
                    · Rule 46 Tax Invoicing & Statutory Compliance
                  </span>
                )}
              </div>
            </div>

            <div className="flex items-center gap-3">
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${isGstEnabled ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-neutral-100 text-neutral-500"}`}>
                {isGstEnabled ? "ACTIVE (CGST/SGST/IGST)" : "STANDBY"}
              </span>
              <button
                disabled={isUpdatingGst}
                onClick={() => onToggleGst(!isGstEnabled)}
                className="text-[11px] font-semibold text-[#0071E3] hover:underline cursor-pointer"
              >
                {isGstEnabled ? "Disable GST" : "Enable GST"}
              </button>
              <button
                onClick={() => onNavigate("gst_hub")}
                className="text-[11px] font-semibold text-neutral-600 hover:text-neutral-900 flex items-center gap-0.5 cursor-pointer"
              >
                Accounting Hub <ChevronRight className="w-3 h-3" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* =========================================================================
          2. CORE EXECUTIVE FINANCIAL MATRIX (4 REAL-TIME METRICS)
      ========================================================================== */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Metric 1: Period Revenue */}
        <div className="bg-white rounded-2xl p-5 border border-black/[0.07] shadow-[0_1px_3px_rgba(0,0,0,0.02)] flex flex-col justify-between hover:border-black/[0.12] transition-colors">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold tracking-wider text-neutral-400 uppercase">
                {revenueTitle}
              </span>
              <div className="w-8 h-8 rounded-xl bg-blue-50 text-[#0071E3] flex items-center justify-center border border-blue-100/60">
                <TrendingUp className="w-4 h-4" strokeWidth={2.2} />
              </div>
            </div>
            <div className="text-2xl sm:text-3xl font-bold font-mono text-neutral-900 tracking-tight mt-2.5">
              {formatCurrency(periodMetrics.revenue)}
            </div>
          </div>

          <div className="pt-3.5 mt-3.5 border-t border-neutral-100 flex items-center justify-between text-xs gap-2">
            {periodMetrics.growthPercent !== null ? (
              <span
                className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-md ${
                  periodMetrics.growthPercent >= 0
                    ? "text-emerald-700 bg-emerald-50"
                    : "text-rose-700 bg-rose-50"
                }`}
              >
                {periodMetrics.growthPercent >= 0 ? (
                  <TrendingUp className="w-3 h-3" />
                ) : (
                  <TrendingDown className="w-3 h-3" />
                )}
                {periodMetrics.growthPercent >= 0 ? "+" : ""}
                {periodMetrics.growthPercent}% vs prev
              </span>
            ) : (
              <span className="text-[11px] font-mono text-neutral-600">
                Avg {formatCurrency(periodMetrics.avgOrderValue)}
              </span>
            )}
            <span className="text-[11px] font-mono text-neutral-500">
              {periodMetrics.orderCount} order{periodMetrics.orderCount === 1 ? "" : "s"}
            </span>
          </div>
        </div>

        {/* Metric 2: Real Net Operating Profit */}
        <div className="bg-white rounded-2xl p-5 border border-black/[0.07] shadow-[0_1px_3px_rgba(0,0,0,0.02)] flex flex-col justify-between hover:border-black/[0.12] transition-colors">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold tracking-wider text-neutral-400 uppercase">
                {profitTitle}
              </span>
              <div
                className={`w-8 h-8 rounded-xl flex items-center justify-center border ${
                  periodMetrics.netProfit >= 0
                    ? "bg-emerald-50 text-emerald-700 border-emerald-100/60"
                    : "bg-rose-50 text-rose-700 border-rose-100/60"
                }`}
              >
                <Sparkles className="w-4 h-4" strokeWidth={2.2} />
              </div>
            </div>
            <div
              className={`text-2xl sm:text-3xl font-bold font-mono tracking-tight mt-2.5 ${
                periodMetrics.netProfit >= 0 ? "text-emerald-700" : "text-rose-600"
              }`}
            >
              {formatCurrency(periodMetrics.netProfit)}
            </div>
          </div>

          <div className="pt-3.5 mt-3.5 border-t border-neutral-100 flex items-center justify-between text-xs gap-2">
            <span
              className={`inline-flex items-center gap-1 text-[11px] font-semibold ${
                periodMetrics.netProfit >= 0 ? "text-emerald-700" : "text-rose-600"
              }`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  periodMetrics.netProfit >= 0 ? "bg-emerald-500" : "bg-rose-500"
                }`}
              />
              {periodMetrics.marginPercent}% Net Margin
            </span>
            <span className="text-[11px] font-mono text-neutral-500">
              Costs {formatCurrency(periodMetrics.totalOutflows)}
            </span>
          </div>
        </div>

        {/* Metric 3: Liquid Treasury & Cash Runway */}
        <div className="bg-white rounded-2xl p-5 border border-black/[0.07] shadow-[0_1px_3px_rgba(0,0,0,0.02)] flex flex-col justify-between hover:border-black/[0.12] transition-colors">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold tracking-wider text-neutral-400 uppercase">
                Liquid Treasury
              </span>
              <div className="w-8 h-8 rounded-xl bg-neutral-100 text-neutral-800 flex items-center justify-center border border-neutral-200/60">
                <Wallet className="w-4 h-4" strokeWidth={2.2} />
              </div>
            </div>
            <div className="text-2xl sm:text-3xl font-bold font-mono text-neutral-900 tracking-tight mt-2.5">
              {formatCurrency(totalLiquid)}
            </div>
          </div>

          <div className="pt-3.5 mt-3.5 border-t border-neutral-100 flex items-center justify-between text-xs gap-2">
            <span className="text-[11px] text-neutral-500">
              Drawer: <strong className="font-mono text-neutral-800">{formatCurrency(cashInHand)}</strong>
            </span>
            <span className="text-[11px] text-neutral-500">
              Banks: <strong className="font-mono text-neutral-800">{formatCurrency(cashInBank)}</strong>
            </span>
          </div>
        </div>

        {/* Metric 4: Customer Receivables & Debtors */}
        <div className="bg-white rounded-2xl p-5 border border-black/[0.07] shadow-[0_1px_3px_rgba(0,0,0,0.02)] flex flex-col justify-between hover:border-black/[0.12] transition-colors">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold tracking-wider text-neutral-400 uppercase">
                Receivables (Credit)
              </span>
              <div className={`w-8 h-8 rounded-xl flex items-center justify-center border ${debtorCustomers.length > 0 ? "bg-amber-50 text-amber-700 border-amber-200/60" : "bg-neutral-100 text-neutral-600 border-neutral-200/60"}`}>
                <Users className="w-4 h-4" strokeWidth={2.2} />
              </div>
            </div>
            <div className="text-2xl sm:text-3xl font-bold font-mono text-neutral-900 tracking-tight mt-2.5">
              {formatCurrency(totalReceivables)}
            </div>
          </div>

          <div className="pt-3.5 mt-3.5 border-t border-neutral-100 flex items-center justify-between text-xs">
            {debtorCustomers.length > 0 ? (
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-800 bg-amber-50 px-2 py-0.5 rounded-md">
                <AlertTriangle className="w-3 h-3" />
                {debtorCustomers.length} active debtor{debtorCustomers.length > 1 ? "s" : ""}
              </span>
            ) : (
              <span className="text-[11px] font-medium text-emerald-700 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" /> All accounts clear
              </span>
            )}
            <button
              onClick={() => {
                setRightPanelTab("debtors");
                const el = document.getElementById("executive-operational-grid");
                if (el) el.scrollIntoView({ behavior: "auto" });
              }}
              className="text-[11px] font-semibold text-[#0071E3] hover:underline cursor-pointer"
            >
              Review →
            </button>
          </div>
        </div>
      </div>

      {/* =========================================================================
          3. VISUAL ANALYTICS & CAPITAL ALLOCATION (2:1 GRID)
      ========================================================================== */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        
        {/* Left (2 cols): Responsive Revenue Velocity Chart */}
        <div className="lg:col-span-2 bg-white rounded-3xl p-5 sm:p-6 border border-black/[0.07] shadow-[0_1px_3px_rgba(0,0,0,0.02)] flex flex-col justify-between">
          <div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-neutral-100 pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm sm:text-base font-bold text-neutral-900">
                    {chartData.title}
                  </h3>
                  <span className="text-[11px] font-mono text-neutral-400">
                    {chartData.badge}
                  </span>
                </div>
                <p className="text-xs text-neutral-500 mt-0.5">
                  {chartData.subtitle}
                </p>
              </div>

              <div className="text-left sm:text-right">
                <span className="text-[11px] text-neutral-400 block uppercase font-bold tracking-wider">
                  {chartData.volumeLabel}
                </span>
                <span className="text-base font-bold font-mono text-[#0071E3]">
                  {formatCurrency(totalChartVolume)}
                </span>
              </div>
            </div>

            {/* Interactive Bar Visualizer */}
            <div className="pt-6 pb-2">
              <div className={`h-44 flex items-end justify-between ${chartData.compact ? "gap-1" : "gap-2.5 sm:gap-4"} px-2 border-b border-neutral-100`}>
                {chartData.buckets.map((b) => {
                  const heightPercent = b.sales > 0 ? Math.max(10, Math.round((b.sales / maxChartSales) * 100)) : 4;
                  const isAboveAvg = b.sales > 0 && b.sales >= avgChartVolume;

                  return (
                    <div
                      key={b.key}
                      className="flex-1 flex flex-col items-center h-full justify-end group cursor-pointer relative"
                    >
                      {/* Interactive Hover Tooltip */}
                      <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-150 absolute -top-9 text-[11px] font-mono font-bold text-white bg-neutral-900 px-2 py-1 rounded-lg shadow-md whitespace-nowrap pointer-events-none z-20">
                        {b.tooltipLabel}: {formatCurrency(b.sales)}
                      </div>

                      {/* Bar Fill */}
                      <div
                        style={{ height: `${heightPercent}%` }}
                        className={`w-full ${chartData.compact ? "max-w-[14px] rounded-t-md" : "max-w-[48px] rounded-t-xl"} transition-all duration-300 relative group-hover:brightness-95 ${
                          b.isCurrent
                            ? "bg-[#0071E3] shadow-xs"
                            : isAboveAvg
                            ? "bg-blue-400"
                            : "bg-neutral-200"
                        }`}
                      >
                        {b.isCurrent && !chartData.compact && (
                          <div className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-2 h-2 rounded-full bg-[#0071E3] ring-4 ring-white" />
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Axis Labels */}
              <div className={`flex justify-between ${chartData.compact ? "gap-1" : "gap-2.5 sm:gap-4"} px-2 pt-2.5 text-xs text-neutral-500 font-medium`}>
                {chartData.buckets.map((b) => (
                  <div key={b.key} className="flex-1 text-center whitespace-nowrap">
                    <span className={b.isCurrent ? "font-bold text-[#0071E3]" : "text-[11px]"}>
                      {b.label}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Chart Summary Legend */}
          <div className="pt-4 mt-2 border-t border-neutral-100 flex flex-wrap items-center justify-between text-xs text-neutral-500 gap-3">
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1.5 text-[11px]">
                <span className="w-2.5 h-2.5 rounded bg-[#0071E3]" /> Current
              </span>
              <span className="flex items-center gap-1.5 text-[11px]">
                <span className="w-2.5 h-2.5 rounded bg-blue-400" /> Above Avg
              </span>
              <span className="flex items-center gap-1.5 text-[11px]">
                <span className="w-2.5 h-2.5 rounded bg-neutral-200" /> Base Volume
              </span>
            </div>
            <span className="font-mono text-[11px] text-neutral-600">
              {chartData.avgLabel}: <strong className="font-bold text-neutral-800">{formatCurrency(avgChartVolume)}</strong>
            </span>
          </div>
        </div>

        {/* Right (1 col): Reconciled Capital & Balance Sheet */}
        <div className="bg-white rounded-3xl p-5 sm:p-6 border border-black/[0.07] shadow-[0_1px_3px_rgba(0,0,0,0.02)] flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
              <div>
                <h3 className="text-sm sm:text-base font-bold text-neutral-900">
                  Capital & Balance Sheet
                </h3>
                <p className="text-[11px] text-neutral-500">
                  Asset allocation & enterprise solvency
                </p>
              </div>
              <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${solvencyStatus.cls}`}>
                {solvencyStatus.label}
              </span>
            </div>

            {/* Stacked Asset Breakdown Progress Bar */}
            <div className="my-4">
              <div className="h-3 w-full bg-neutral-100 rounded-full overflow-hidden flex shadow-inner">
                <div
                  style={{ width: `${Math.round((cashInBank / Math.max(1, totalAssets)) * 100)}%` }}
                  className="bg-blue-600 transition-all"
                  title={`Bank Liquidity: ${formatCurrency(cashInBank)}`}
                />
                <div
                  style={{ width: `${Math.round((cashInHand / Math.max(1, totalAssets)) * 100)}%` }}
                  className="bg-emerald-500 transition-all"
                  title={`Cash Drawer: ${formatCurrency(cashInHand)}`}
                />
                <div
                  style={{ width: `${Math.round((totalStockValuation / Math.max(1, totalAssets)) * 100)}%` }}
                  className="bg-purple-500 transition-all"
                  title={`Stock Cost Valuation: ${formatCurrency(totalStockValuation)}`}
                />
                <div
                  style={{ width: `${Math.round((totalReceivables / Math.max(1, totalAssets)) * 100)}%` }}
                  className="bg-amber-500 transition-all"
                  title={`Receivables: ${formatCurrency(totalReceivables)}`}
                />
              </div>

              {/* Legend rows */}
              <div className="mt-4 space-y-2 text-xs">
                <div className="flex items-center justify-between py-1 border-b border-neutral-50">
                  <span className="flex items-center gap-2 text-neutral-600">
                    <span className="w-2 h-2 rounded-full bg-blue-600" />
                    Commercial Bank Reserves {bankAccounts.length > 0 ? `(${bankAccounts.length})` : ""}
                  </span>
                  <span className="font-mono font-bold text-neutral-900">
                    {formatCurrency(cashInBank)}
                  </span>
                </div>

                <div className="flex items-center justify-between py-1 border-b border-neutral-50">
                  <span className="flex items-center gap-2 text-neutral-600">
                    <span className="w-2 h-2 rounded-full bg-emerald-500" />
                    Physical Counter Float
                  </span>
                  <span className="font-mono font-bold text-neutral-900">
                    {formatCurrency(cashInHand)}
                  </span>
                </div>

                <div className="flex items-center justify-between py-1 border-b border-neutral-50">
                  <span className="flex items-center gap-2 text-neutral-600">
                    <span className="w-2 h-2 rounded-full bg-purple-500" />
                    Inventory Cost Valuation
                  </span>
                  <span className="font-mono font-bold text-neutral-900">
                    {formatCurrency(totalStockValuation)}
                  </span>
                </div>

                <div className="flex items-center justify-between py-1">
                  <span className="flex items-center gap-2 text-neutral-600">
                    <span className="w-2 h-2 rounded-full bg-amber-500" />
                    Pending Customer Receivables
                  </span>
                  <span className="font-mono font-bold text-neutral-900">
                    {formatCurrency(totalReceivables)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Net Worth Summary Box */}
          <div className="p-3.5 rounded-2xl bg-neutral-50 border border-neutral-200/70 mt-3">
            <div className="flex items-center justify-between text-xs">
              <span className="text-neutral-500">Gross Total Assets:</span>
              <span className="font-mono font-semibold text-neutral-800">{formatCurrency(totalAssets)}</span>
            </div>
            <div className="flex items-center justify-between text-xs mt-1">
              <span className="text-neutral-500">Total Liabilities:</span>
              <span className="font-mono font-semibold text-rose-600">-{formatCurrency(totalLiabilities)}</span>
            </div>
            <div className="pt-2 mt-2 border-t border-neutral-200/80 flex items-center justify-between">
              <span className="text-xs font-bold text-neutral-800 uppercase tracking-tight">Net Enterprise Worth:</span>
              <span className="font-mono font-bold text-sm text-[#0071E3]">{formatCurrency(netWorth)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* =========================================================================
          4. DUAL OPERATIONAL COMMAND GRID (1:1 SPLIT)
      ========================================================================== */}
      <div id="executive-operational-grid" className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        
        {/* Left Column: Live Sales & Counter Activity Stream */}
        <div className="bg-white rounded-3xl p-5 sm:p-6 border border-black/[0.07] shadow-[0_1px_3px_rgba(0,0,0,0.02)] space-y-4">
          
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-neutral-100 pb-3.5">
            <div>
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-blue-50 text-[#0071E3] flex items-center justify-center">
                  <Receipt className="w-4 h-4" />
                </div>
                <h3 className="text-sm sm:text-base font-bold text-neutral-900">
                  Transaction Feed
                </h3>
              </div>
              <p className="text-[11px] text-neutral-500 mt-0.5">
                Counter sales, invoices, and instant payment methods
              </p>
            </div>

            {/* Filter pills */}
            <div className="flex items-center p-0.5 bg-neutral-100 rounded-xl text-xs">
              {(["ALL", "CASH", "CARD", "CREDIT"] as const).map((filter) => (
                <button
                  key={filter}
                  onClick={() => setTransactionFilter(filter)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition cursor-pointer ${
                    transactionFilter === filter
                      ? "bg-white text-neutral-900 font-bold shadow-xs"
                      : "text-neutral-500 hover:text-neutral-800"
                  }`}
                >
                  {filter}
                </button>
              ))}
            </div>
          </div>

          {/* Quick Search inside feed */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
            <input
              type="text"
              placeholder="Search by invoice # or customer name..."
              value={searchTx}
              onChange={(e) => setSearchTx(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-neutral-50 border border-neutral-200/70 rounded-xl focus:outline-none focus:border-[#0071E3] transition"
            />
          </div>

          {/* Transaction Rows */}
          <div className="divide-y divide-neutral-100 max-h-[360px] overflow-y-auto pr-1">
            {recentSales.length > 0 ? (
              recentSales.map((inv) => {
                const initials = (inv.party_name || "Walk In")
                  .split(" ")
                  .filter(Boolean)
                  .map((w) => w[0])
                  .slice(0, 2)
                  .join("")
                  .toUpperCase();

                const isPaid = inv.status === "PAID";
                const isCredit = inv.status === "CREDIT" || inv.status === "UNPAID" || inv.status === "PARTIAL";

                return (
                  <div
                    key={inv.id}
                    className="py-3 flex items-center justify-between gap-3 hover:bg-neutral-50/80 px-2 rounded-xl transition"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-neutral-100 text-neutral-700 flex items-center justify-center font-bold text-xs shrink-0 border border-neutral-200/50">
                        {initials || "WI"}
                      </div>
                      <div>
                        <div className="font-semibold text-xs text-neutral-900 line-clamp-1">
                          {inv.party_name || "Walk-in Retail Customer"}
                        </div>
                        <div className="text-[11px] text-neutral-500 flex items-center gap-2 mt-0.5">
                          <span className="font-mono text-neutral-400">{inv.invoice_number}</span>
                          <span>·</span>
                          <span>{inv.invoice_date}</span>
                          <span>·</span>
                          <span className="px-1.5 py-0.2 rounded bg-neutral-100 text-neutral-700 font-medium text-[10px]">
                            {inv.payment_method || "Cash"}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="text-right shrink-0 flex items-center gap-2">
                      <div>
                        <div className="font-mono font-bold text-xs text-neutral-900">
                          +{formatCurrency(inv.total_amount)}
                        </div>
                        <span
                          className={`inline-block text-[10px] font-bold px-1.5 py-0.2 rounded mt-0.5 ${
                            isPaid
                              ? "bg-emerald-50 text-emerald-700"
                              : isCredit
                              ? "bg-amber-50 text-amber-700"
                              : "bg-blue-50 text-blue-700"
                          }`}
                        >
                          {inv.status}
                        </span>
                      </div>
                      {isCredit && (
                        <button
                          onClick={() => onOpenCreditPay(inv)}
                          className="px-2 py-1 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200/60 text-[10px] font-bold transition cursor-pointer"
                        >
                          Settle
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="py-8 text-center text-xs text-neutral-400">
                No matching transactions in this period.
              </div>
            )}
          </div>

          <div className="pt-2 border-t border-neutral-100 flex items-center justify-between text-xs">
            <span className="text-neutral-400 text-[11px]">
              Showing {recentSales.length} counter transaction{recentSales.length === 1 ? "" : "s"}
            </span>
            <button
              onClick={() => onNavigate("invoices")}
              className="font-semibold text-[#0071E3] hover:underline flex items-center gap-1 cursor-pointer"
            >
              All Invoices & Ledger <ArrowRight className="w-3 h-3" />
            </button>
          </div>
        </div>

        {/* Right Column: Debtors Watchlist & Inventory Health Tabbed Panel */}
        <div className="bg-white rounded-3xl p-5 sm:p-6 border border-black/[0.07] shadow-[0_1px_3px_rgba(0,0,0,0.02)] space-y-4">
          
          <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setRightPanelTab("debtors")}
                className={`text-xs sm:text-sm font-bold pb-1 transition cursor-pointer border-b-2 ${
                  rightPanelTab === "debtors"
                    ? "border-[#0071E3] text-neutral-900"
                    : "border-transparent text-neutral-400 hover:text-neutral-700"
                }`}
              >
                Debtors Watchlist ({debtorCustomers.length})
              </button>
              <button
                onClick={() => setRightPanelTab("inventory")}
                className={`text-xs sm:text-sm font-bold pb-1 transition cursor-pointer border-b-2 ${
                  rightPanelTab === "inventory"
                    ? "border-[#0071E3] text-neutral-900"
                    : "border-transparent text-neutral-400 hover:text-neutral-700"
                }`}
              >
                Catalog Health ({lowStockItems.length} Low)
              </button>
            </div>

            <button
              onClick={() => onNavigate(rightPanelTab === "debtors" ? "parties" : "inventory")}
              className="text-xs font-semibold text-[#0071E3] hover:underline cursor-pointer"
            >
              View Full
            </button>
          </div>

          {/* Panel 1: Debtors Watchlist */}
          {rightPanelTab === "debtors" && (
            <div className="space-y-3">
              <div className="text-[11px] text-neutral-500">
                Accounts with outstanding balance ranked by exposure. Click <strong>Settle</strong> to record payment immediately.
              </div>

              <div className="divide-y divide-neutral-100 max-h-[320px] overflow-y-auto pr-1">
                {debtorCustomers.length > 0 ? (
                  debtorCustomers.map((c) => (
                    <div
                      key={c.id}
                      className="py-3 flex items-center justify-between gap-3 hover:bg-neutral-50/80 px-2 rounded-xl transition"
                    >
                      <div>
                        <div className="font-semibold text-xs text-neutral-900">
                          {c.name}
                        </div>
                        <div className="text-[11px] text-neutral-500 flex items-center gap-2 mt-0.5">
                          <span className="font-mono text-neutral-400">{c.phone || "No phone"}</span>
                          <span>·</span>
                          <span className="text-amber-700 font-medium">Pending Settlement</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <div className="font-mono font-bold text-xs text-rose-600">
                            {formatCurrency(c.current_balance)}
                          </div>
                          <span className="text-[10px] text-neutral-400 uppercase font-bold tracking-wider">
                            Due
                          </span>
                        </div>

                        <button
                          onClick={() => onOpenCustomerPay(c)}
                          className="px-3 py-1.5 rounded-xl bg-neutral-900 hover:bg-black text-white text-xs font-semibold transition apple-press cursor-pointer shrink-0"
                        >
                          Settle
                        </button>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="py-12 text-center text-xs text-neutral-400 flex flex-col items-center gap-2">
                    <CheckCircle2 className="w-8 h-8 text-emerald-500" />
                    <span>No overdue customer credit. All accounts fully settled!</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Panel 2: Inventory Health & Low Stock Radar */}
          {rightPanelTab === "inventory" && (
            <div className="space-y-3">
              <div className="text-[11px] text-neutral-500">
                Catalog items approaching reorder thresholds. Restock to prevent counter stockouts.
              </div>

              <div className="divide-y divide-neutral-100 max-h-[320px] overflow-y-auto pr-1">
                {lowStockItems.length > 0 ? (
                  lowStockItems.map((it) => {
                    const ratio = it.stock_quantity / Math.max(1, it.min_stock_alert);
                    const isCritical = ratio <= 0.5;

                    return (
                      <div
                        key={it.id}
                        className="py-3 flex items-center justify-between gap-3 hover:bg-neutral-50/80 px-2 rounded-xl transition"
                      >
                        <div>
                          <div className="font-semibold text-xs text-neutral-900 line-clamp-1">
                            {it.name}
                          </div>
                          <div className="text-[11px] text-neutral-500 flex items-center gap-2 mt-0.5">
                            <span className="px-1.5 py-0.2 rounded bg-neutral-100 text-neutral-600 text-[10px]">
                              {it.category || "General"}
                            </span>
                            <span>·</span>
                            <span className="font-mono">Min Alert: {it.min_stock_alert} {it.unit}</span>
                          </div>
                        </div>

                        <div className="text-right shrink-0">
                          <div className={`font-mono font-bold text-xs ${isCritical ? "text-rose-600" : "text-amber-600"}`}>
                            {it.stock_quantity} {it.unit} left
                          </div>
                          <span className={`text-[10px] font-bold ${isCritical ? "text-rose-600" : "text-amber-600"}`}>
                            {isCritical ? "Critical Reorder" : "Low Stock"}
                          </span>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="py-12 text-center text-xs text-neutral-400 flex flex-col items-center gap-2">
                    <PackageCheck className="w-8 h-8 text-emerald-500" />
                    <span>Inventory levels optimal across all SKU categories!</span>
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="pt-2 border-t border-neutral-100 flex items-center justify-between text-xs">
            <span className="text-neutral-400 text-[11px]">
              Offline Database Synchronized
            </span>
            <button
              onClick={() => onNavigate("reports")}
              className="font-semibold text-[#0071E3] hover:underline flex items-center gap-1 cursor-pointer"
            >
              Daybook Audit Reports <ChevronRight className="w-3 h-3" />
            </button>
          </div>
        </div>
      </div>

    </div>
  );
};
