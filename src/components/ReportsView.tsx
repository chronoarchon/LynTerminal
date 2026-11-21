import React, { useState, useEffect, useMemo } from "react";
import {
  Printer,
  ClipboardCheck,
  X,
} from "lucide-react";
import type { DaybookEntry, DashboardSummary, Item, Settings, CashClosing } from "../types";
import { api } from "../services/api";
import { useCurrency } from "../context/CurrencyContext";

interface ReportsViewProps {
  settings: Settings | null;
  summary: DashboardSummary | null;
}

export const ReportsView: React.FC<ReportsViewProps> = ({ settings: _settings, summary }) => {
  const { currencySymbol, formatCurrency } = useCurrency();
  const [activeTab, setActiveTab] = useState<"daybook" | "pnl" | "stock" | "closings">("daybook");
  const [selectedDate, setSelectedDate] = useState<string>(
    new Date().toISOString().split("T")[0]
  );
  const [daybookEntries, setDaybookEntries] = useState<DaybookEntry[]>([]);
  const [loadingDaybook, setLoadingDaybook] = useState(false);
  const [items, setItems] = useState<Item[]>([]);
  const [loadingItems, setLoadingItems] = useState(false);

  // Shift Closings / Z-Report
  const [cashClosings, setCashClosings] = useState<CashClosing[]>([]);
  const [loadingClosings, setLoadingClosings] = useState(false);
  const [isClosingModalOpen, setIsClosingModalOpen] = useState(false);
  const [closingDate, setClosingDate] = useState(new Date().toISOString().split("T")[0]);
  const [openingFloat, setOpeningFloat] = useState("100.00");
  const [salesCash, setSalesCash] = useState("0.00");
  const [actualCash, setActualCash] = useState("100.00");
  const [closingNotes, setClosingNotes] = useState("Standard evening register reconciliation");
  const [isSubmittingClosing, setIsSubmittingClosing] = useState(false);

  const loadDaybook = async (date: string) => {
    try {
      setLoadingDaybook(true);
      const data = await api.getDaybook(date);
      setDaybookEntries(data);
    } catch (err) {
      console.error("Failed to load daybook:", err);
    } finally {
      setLoadingDaybook(false);
    }
  };

  const loadStockReport = async () => {
    try {
      setLoadingItems(true);
      const data = await api.listItems();
      setItems(data);
    } catch (err) {
      console.error("Failed to load items for stock valuation:", err);
    } finally {
      setLoadingItems(false);
    }
  };

  const loadClosings = async () => {
    try {
      setLoadingClosings(true);
      const data = await api.listCashClosings();
      setCashClosings(data);
    } catch (err) {
      console.error("Failed to load cash closings:", err);
    } finally {
      setLoadingClosings(false);
    }
  };

  useEffect(() => {
    if (activeTab === "daybook") {
      loadDaybook(selectedDate);
    } else if (activeTab === "stock") {
      loadStockReport();
    } else if (activeTab === "closings") {
      loadClosings();
    }
  }, [activeTab, selectedDate]);

  const totalInflow = useMemo(() => {
    return daybookEntries.reduce((sum, e) => sum + e.cash_in, 0);
  }, [daybookEntries]);

  const totalOutflow = useMemo(() => {
    return daybookEntries.reduce((sum, e) => sum + e.cash_out, 0);
  }, [daybookEntries]);

  const netDayCash = totalInflow - totalOutflow;

  const handleOpenClosingModal = () => {
    setClosingDate(new Date().toISOString().split("T")[0]);
    setSalesCash(totalInflow.toFixed(2));
    const openVal = parseFloat(openingFloat) || 100;
    setActualCash((openVal + totalInflow).toFixed(2));
    setIsClosingModalOpen(true);
  };

  const handleSaveClosing = async (e: React.FormEvent) => {
    e.preventDefault();
    const openVal = parseFloat(openingFloat) || 0;
    const sCash = parseFloat(salesCash) || 0;
    const actVal = parseFloat(actualCash) || 0;
    const expVal = openVal + sCash;
    const variance = actVal - expVal;

    try {
      setIsSubmittingClosing(true);
      await api.recordCashClosing({
        id: "",
        shift_date: closingDate,
        opening_cash: openVal,
        sales_cash: sCash,
        expected_cash: expVal,
        actual_cash: actVal,
        variance,
        notes: closingNotes,
        closed_at: "",
      });
      setIsClosingModalOpen(false);
      await loadClosings();
      setActiveTab("closings");
    } catch (err) {
      alert("Failed to record shift closing: " + err);
    } finally {
      setIsSubmittingClosing(false);
    }
  };

  // Stock Valuation calculations
  const totalStockUnits = useMemo(() => {
    return items.reduce((sum, i) => sum + i.stock_quantity, 0);
  }, [items]);

  const totalCostValuation = useMemo(() => {
    return items.reduce((sum, i) => sum + i.stock_quantity * i.purchase_price, 0);
  }, [items]);

  const totalRetailValuation = useMemo(() => {
    return items.reduce((sum, i) => sum + i.stock_quantity * i.sale_price, 0);
  }, [items]);

  const unrealizedProfit = totalRetailValuation - totalCostValuation;

  // P&L figures
  const grossSales = summary?.total_sales || 0;
  const cogs = summary?.total_purchases || 0;
  const grossProfit = grossSales - cogs;
  const operatingExpenses = summary?.total_expenses || 0;
  const netProfit = summary?.net_profit || 0;
  const grossMargin = grossSales > 0 ? (grossProfit / grossSales) * 100 : 0;
  const netMargin = grossSales > 0 ? (netProfit / grossSales) * 100 : 0;

  return (
    <div className="space-y-5 max-w-6xl mx-auto select-none">
      
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-black/[0.07]">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[#1D1D1F]">
            Financial Reports
          </h1>
          <p className="text-xs text-[#86868B] mt-0.5">
            Daily cash daybook, Profit & Loss statement, and stock valuation
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleOpenClosingModal}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-[#0071E3] hover:bg-[#0077ED] text-white text-xs font-bold shadow-xs transition apple-press"
          >
            <ClipboardCheck className="w-3.5 h-3.5" />
            <span>Shift Close (Z-Report)</span>
          </button>

          <button
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-black/[0.08] bg-white hover:bg-[#F5F5F7] text-[#1D1D1F] text-xs font-semibold shadow-2xs transition apple-press"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print</span>
          </button>
        </div>
      </div>

      {/* Segmented Report Selector */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-2xl apple-card shrink-0">
        <div className="flex items-center p-0.5 bg-[#F5F5F7] rounded-xl border border-black/[0.06] text-xs">
          <button
            onClick={() => setActiveTab("daybook")}
            className={`px-3 py-1 rounded-lg text-xs font-medium transition ${
              activeTab === "daybook"
                ? "bg-white text-[#1D1D1F] shadow-xs font-semibold"
                : "text-[#86868B] hover:text-[#1D1D1F]"
            }`}
          >
            Cash Daybook
          </button>
          <button
            onClick={() => setActiveTab("pnl")}
            className={`px-3 py-1 rounded-lg text-xs font-medium transition ${
              activeTab === "pnl"
                ? "bg-white text-[#1D1D1F] shadow-xs font-semibold"
                : "text-[#86868B] hover:text-[#1D1D1F]"
            }`}
          >
            Profit & Loss
          </button>
          <button
            onClick={() => setActiveTab("stock")}
            className={`px-3 py-1 rounded-lg text-xs font-medium transition ${
              activeTab === "stock"
                ? "bg-white text-[#1D1D1F] shadow-xs font-semibold"
                : "text-[#86868B] hover:text-[#1D1D1F]"
            }`}
          >
            Stock Valuation
          </button>
          <button
            onClick={() => setActiveTab("closings")}
            className={`px-3 py-1 rounded-lg text-xs font-medium transition ${
              activeTab === "closings"
                ? "bg-white text-[#1D1D1F] shadow-xs font-semibold"
                : "text-[#86868B] hover:text-[#1D1D1F]"
            }`}
          >
            Shift Closings
          </button>
        </div>

        {activeTab === "daybook" && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-[#86868B]">Date:</span>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="px-3 py-1 rounded-xl border border-black/[0.08] bg-[#F5F5F7] text-xs font-medium focus:outline-none focus:border-black"
            />
          </div>
        )}
      </div>

      {/* TAB 1: Daybook */}
      {activeTab === "daybook" && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="apple-card p-4 rounded-2xl">
              <div className="text-[11px] font-medium text-[#86868B]">Cash Inflows</div>
              <div className="text-xl font-bold font-mono text-[#34C759] mt-0.5">
                +{formatCurrency(totalInflow)}
              </div>
            </div>
            <div className="apple-card p-4 rounded-2xl">
              <div className="text-[11px] font-medium text-[#86868B]">Cash Outflows</div>
              <div className="text-xl font-bold font-mono text-[#FF3B30] mt-0.5">
                -{formatCurrency(totalOutflow)}
              </div>
            </div>
            <div className="apple-card p-4 rounded-2xl">
              <div className="text-[11px] font-medium text-[#86868B]">Net Cash Movement</div>
              <div className="text-xl font-bold font-mono text-[#1D1D1F] mt-0.5">
                {netDayCash >= 0 ? `+${formatCurrency(netDayCash)}` : formatCurrency(netDayCash)}
              </div>
            </div>
          </div>

          <div className="apple-card rounded-2xl overflow-hidden shadow-2xs">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="border-b border-black/[0.06] bg-[#FBFBFC] text-[#86868B] font-semibold text-[11px]">
                  <th className="py-3 px-4">Transaction / Type</th>
                  <th className="py-3 px-3">Title / Particulars</th>
                  <th className="py-3 px-3 text-right">Cash In</th>
                  <th className="py-3 px-3 text-right">Cash Out</th>
                  <th className="py-3 px-4 text-right">Balance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/[0.04]">
                {loadingDaybook ? (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-[#86868B] text-xs">
                      Loading daybook records...
                    </td>
                  </tr>
                ) : daybookEntries.map((e, idx) => (
                  <tr key={idx} className="hover:bg-[#FBFBFC] transition-colors">
                    <td className="py-3 px-4">
                      <span className="font-semibold text-[#1D1D1F]">{e.entry_type}</span>
                      {e.reference && (
                        <div className="text-[10px] text-[#86868B] font-mono">{e.reference}</div>
                      )}
                    </td>
                    <td className="py-3 px-3 text-[#1D1D1F] font-medium">{e.title}</td>
                    <td className="py-3 px-3 text-right font-mono font-bold text-[#34C759]">
                      {e.cash_in > 0 ? `+${formatCurrency(e.cash_in)}` : "—"}
                    </td>
                    <td className="py-3 px-3 text-right font-mono font-bold text-[#FF3B30]">
                      {e.cash_out > 0 ? `-${formatCurrency(e.cash_out)}` : "—"}
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-semibold text-[#1D1D1F]">
                      {formatCurrency(e.balance)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {!loadingDaybook && daybookEntries.length === 0 && (
              <div className="py-12 text-center text-[#86868B] text-xs">
                No cash transactions recorded on {selectedDate}.
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: Profit & Loss Statement */}
      {activeTab === "pnl" && (
        <div className="apple-card p-6 sm:p-8 rounded-3xl space-y-6 max-w-2xl mx-auto shadow-sm select-text">
          <div className="text-center pb-4 border-b border-black/[0.06]">
            <h2 className="text-xl font-bold tracking-tight text-[#1D1D1F]">
              Profit & Loss Statement
            </h2>
            <p className="text-xs text-[#86868B] mt-0.5">
              Operating Financial Performance & Trading Margins
            </p>
          </div>

          <div className="space-y-4 text-xs">
            {/* Revenue */}
            <div className="space-y-1.5">
              <div className="flex justify-between font-bold text-sm text-[#1D1D1F]">
                <span>1. Gross Sales Revenue</span>
                <span className="font-mono">{formatCurrency(grossSales)}</span>
              </div>
              <div className="flex justify-between text-[#6E6E73] pl-3">
                <span>Less: Cost of Goods Sold (COGS)</span>
                <span className="font-mono">-{formatCurrency(cogs)}</span>
              </div>
              <div className="flex justify-between font-bold text-[#34C759] pt-1 border-t border-black/[0.04]">
                <span>Gross Trading Profit (Margin: {grossMargin.toFixed(1)}%)</span>
                <span className="font-mono">{formatCurrency(grossProfit)}</span>
              </div>
            </div>

            {/* Operating Expenses */}
            <div className="space-y-1.5 pt-2 border-t border-black/[0.06]">
              <div className="flex justify-between font-bold text-sm text-[#1D1D1F]">
                <span>2. Store Operating Expenses</span>
                <span className="font-mono text-[#FF3B30]">-{formatCurrency(operatingExpenses)}</span>
              </div>
              <div className="flex justify-between text-[#86868B] pl-3">
                <span>Rent, Salaries, Utilities & Miscellaneous Outlays</span>
                <span>Audit Verified</span>
              </div>
            </div>

            {/* Net Operating Profit */}
            <div className="pt-4 border-t-2 border-black/[0.1] flex justify-between items-baseline">
              <div>
                <span className="font-bold text-base text-[#1D1D1F] block">
                  Net Operating Profit
                </span>
                <span className="text-[11px] text-[#86868B]">
                  Net Margin: {netMargin.toFixed(1)}% of revenue
                </span>
              </div>
              <span
                className={`font-mono text-2xl font-bold ${
                  netProfit >= 0 ? "text-black" : "text-rose-600"
                }`}
              >
                {formatCurrency(netProfit)}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: Stock Asset Valuation */}
      {activeTab === "stock" && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <div className="apple-card p-4 rounded-2xl">
              <div className="text-[11px] font-medium text-[#86868B]">Units on Hand</div>
              <div className="text-xl font-bold font-mono text-[#1D1D1F] mt-0.5">
                {totalStockUnits.toLocaleString()}
              </div>
            </div>
            <div className="apple-card p-4 rounded-2xl">
              <div className="text-[11px] font-medium text-[#86868B]">Asset Valuation (Cost)</div>
              <div className="text-xl font-bold font-mono text-black mt-0.5">
                {formatCurrency(totalCostValuation)}
              </div>
            </div>
            <div className="apple-card p-4 rounded-2xl">
              <div className="text-[11px] font-medium text-[#86868B]">Retail Valuation</div>
              <div className="text-xl font-bold font-mono text-[#1D1D1F] mt-0.5">
                {formatCurrency(totalRetailValuation)}
              </div>
            </div>
            <div className="apple-card p-4 rounded-2xl">
              <div className="text-[11px] font-medium text-[#86868B]">Unrealized Markup</div>
              <div className="text-xl font-bold font-mono text-emerald-600 mt-0.5">
                +{formatCurrency(unrealizedProfit)}
              </div>
            </div>
          </div>

          <div className="apple-card rounded-2xl overflow-hidden shadow-2xs">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="border-b border-black/[0.06] bg-[#FBFBFC] text-[#86868B] font-semibold text-[11px]">
                  <th className="py-3 px-4">Product Name</th>
                  <th className="py-3 px-3">Units in Stock</th>
                  <th className="py-3 px-3 text-right">Cost Price</th>
                  <th className="py-3 px-3 text-right">Retail Price</th>
                  <th className="py-3 px-4 text-right">Total Asset Cost</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/[0.04]">
                {loadingItems ? (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-[#86868B] text-xs">
                      Loading catalog stock valuation...
                    </td>
                  </tr>
                ) : items.map((i) => (
                  <tr key={i.id} className="hover:bg-[#FBFBFC] transition-colors">
                    <td className="py-3 px-4 font-semibold text-[#1D1D1F]">{i.name}</td>
                    <td className="py-3 px-3 font-mono">{i.stock_quantity} {i.unit}</td>
                    <td className="py-3 px-3 text-right font-mono text-[#6E6E73]">{formatCurrency(i.purchase_price)}</td>
                    <td className="py-3 px-3 text-right font-mono text-[#1D1D1F]">{formatCurrency(i.sale_price)}</td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-black">
                      {formatCurrency(i.stock_quantity * i.purchase_price)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 4: Shift Closings (Z-Reports) */}
      {activeTab === "closings" && (
        <div className="apple-card rounded-2xl overflow-hidden shadow-2xs">
          <table className="w-full text-xs text-left">
            <thead>
              <tr className="border-b border-black/[0.06] bg-[#FBFBFC] text-[#86868B] font-semibold text-[11px]">
                <th className="py-3 px-4">Shift Date</th>
                <th className="py-3 px-3">Opening Float</th>
                <th className="py-3 px-3">Sales Cash</th>
                <th className="py-3 px-3">Expected Cash</th>
                <th className="py-3 px-3">Actual Count</th>
                <th className="py-3 px-4 text-right">Variance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/[0.04]">
              {loadingClosings ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-[#86868B] text-xs">
                    Loading shift closings...
                  </td>
                </tr>
              ) : cashClosings.map((c) => (
                <tr key={c.id} className="hover:bg-[#FBFBFC] transition-colors">
                  <td className="py-3.5 px-4 font-semibold text-[#1D1D1F]">{c.shift_date}</td>
                  <td className="py-3.5 px-3 font-mono text-[#6E6E73]">{formatCurrency(c.opening_cash)}</td>
                  <td className="py-3.5 px-3 font-mono text-[#6E6E73]">{formatCurrency(c.sales_cash)}</td>
                  <td className="py-3.5 px-3 font-mono text-[#1D1D1F]">{formatCurrency(c.expected_cash)}</td>
                  <td className="py-3.5 px-3 font-mono font-bold text-[#1D1D1F]">{formatCurrency(c.actual_cash)}</td>
                  <td className="py-3.5 px-4 text-right font-mono font-bold">
                    <span
                      className={`px-2 py-0.5 rounded-md ${
                        c.variance === 0
                          ? "bg-emerald-50 text-emerald-700"
                          : c.variance > 0
                          ? "bg-black/5 text-black"
                          : "bg-rose-50 text-rose-700"
                      }`}
                    >
                      {c.variance > 0 ? `+${formatCurrency(c.variance)}` : formatCurrency(c.variance)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {cashClosings.length === 0 && (
            <div className="py-12 text-center text-[#86868B] text-xs">
              No shift closings logged yet. Press "Shift Close (Z-Report)" to record one.
            </div>
          )}
        </div>
      )}

      {/* SHIFT CLOSE MODAL */}
      {isClosingModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm border border-black/[0.08] overflow-hidden animate-in fade-in zoom-in-95 duration-150 text-black">
            <div className="px-5 py-4 border-b border-black/[0.08] flex items-center justify-between bg-[#F9FAFB]">
              <div>
                <h3 className="text-sm font-bold text-black tracking-tight">
                  Shift Close
                </h3>
                <p className="text-[11px] text-neutral-400">Cash drawer audit</p>
              </div>
              <button
                onClick={() => setIsClosingModalOpen(false)}
                className="w-7 h-7 rounded-full text-neutral-400 hover:text-black hover:bg-black/5 flex items-center justify-center transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveClosing} className="p-5 space-y-3.5">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-semibold text-neutral-700 block mb-1">
                    Opening Float ({currencySymbol})
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={openingFloat}
                    onChange={(e) => setOpeningFloat(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-black/[0.08] bg-white text-xs font-mono font-bold text-black focus:outline-none focus:border-black"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-neutral-700 block mb-1">
                    Sales Cash ({currencySymbol})
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={salesCash}
                    onChange={(e) => setSalesCash(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-black/[0.08] bg-white text-xs font-mono font-bold text-black focus:outline-none focus:border-black"
                  />
                </div>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-neutral-700 block mb-1">
                  Counted Cash ({currencySymbol}) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={actualCash}
                  onChange={(e) => setActualCash(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-black/[0.08] bg-white text-xs font-mono font-bold text-black focus:outline-none focus:border-black placeholder:text-neutral-400"
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-neutral-700 block mb-1">
                  Audit Notes
                </label>
                <input
                  type="text"
                  value={closingNotes}
                  onChange={(e) => setClosingNotes(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-black/[0.08] bg-white text-xs font-medium text-black focus:outline-none focus:border-black placeholder:text-neutral-400"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsClosingModalOpen(false)}
                  className="flex-1 py-2.5 rounded-full border border-black/[0.1] text-xs font-semibold text-black bg-white hover:bg-neutral-100 cursor-pointer shadow-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingClosing}
                  className="flex-1 py-2.5 rounded-full bg-[#0071E3] hover:bg-[#0077ED] text-white text-xs font-bold uppercase tracking-wider shadow-md transition cursor-pointer"
                >
                  {isSubmittingClosing ? "Closing..." : "Close Shift"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
