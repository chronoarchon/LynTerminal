import React, { useState, useEffect } from "react";
import {
  Scale,
  TrendingUp,
  TrendingDown,
  ShieldCheck,
  Zap,
  ArrowRight,
  RefreshCw,
} from "lucide-react";
import type { GstSettings, Gstr3bReportData } from "./gstTypes";
import type { Settings } from "../../types";
import { gstApi } from "./gstApi";

export interface AccountingHubProps {
  settings: Settings;
  gstSettings: GstSettings;
  onNavigateTab: (tab: string) => void;
}

export const AccountingHub: React.FC<AccountingHubProps> = ({
  settings,
  gstSettings,
  onNavigateTab,
}) => {
  const [gstr3b, setGstr3b] = useState<Gstr3bReportData | null>(null);
  const [loading, setLoading] = useState(false);

  const today = new Date();
  const firstDay = new Date(today.getFullYear(), today.getMonth(), 1)
    .toISOString()
    .split("T")[0];
  const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0)
    .toISOString()
    .split("T")[0];

  const fetchLedgers = () => {
    setLoading(true);
    gstApi
      .getGstr3bReport(firstDay, lastDay)
      .then(setGstr3b)
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchLedgers();
  }, []);

  const vouchers = [
    { key: "F8", label: "Sales Voucher (GST Tax Invoice)", desc: "Rule 46 Outward Supply with HSN & Split Taxes", action: () => onNavigateTab("gst_pos") },
    { key: "F9", label: "Purchase Voucher (Vendor Inward)", desc: "Record inward stock with Input Tax Credit (ITC)", action: () => onNavigateTab("invoices") },
    { key: "F6", label: "Receipt Voucher (Sundry Debtor)", desc: "Settle customer credit bill-by-bill", action: () => onNavigateTab("gst_credit") },
    { key: "F5", label: "Payment Voucher (Sundry Creditor)", desc: "Settle supplier bills and recurring liabilities", action: () => onNavigateTab("gst_credit") },
    { key: "F4", label: "Contra Voucher (Bank / Cash)", desc: "Deposit or withdraw cash from commercial banks", action: () => onNavigateTab("expenses") },
    { key: "GSTR-1", label: "GSTR-1 Monthly Return", desc: "Outward supply return (Tables 4, 5, 7, 12, 13) with GSTN JSON", action: () => onNavigateTab("gstr1") },
    { key: "GSTR-3B", label: "GSTR-3B Self-Declaration", desc: "Monthly summary return, ITC set-off & cash tax payable", action: () => onNavigateTab("gstr3b") },
    { key: "Aging", label: "Sundry Debtors & Creditors Aging", desc: "0-30, 31-60, 61-90, 90+ days overdue analysis & statements", action: () => onNavigateTab("gst_credit") },
  ];

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="p-6 bg-gradient-to-r from-[#1D1D1F] to-[#2C2C2E] rounded-3xl text-white shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-black uppercase tracking-widest px-2.5 py-0.5 rounded-full bg-black text-white">
              Statutory ERP Accounting Gateway
            </span>
            {gstSettings.gstin && gstSettings.gstin !== "27AABCU9603R1ZN" && gstSettings.gstin !== "27AABCU9603R1ZM" && (
              <span className="text-xs text-neutral-400 font-mono">
                GSTIN: {gstSettings.gstin}
              </span>
            )}
          </div>
          <h2 className="text-2xl font-bold tracking-tight mt-2">
            Gateway of {settings.business_name || "Business"} OS
          </h2>
          <p className="text-xs text-neutral-400 mt-1 max-w-xl">
            Double-entry bookkeeping, Bill-by-Bill customer & supplier credit tracking, Rule 46 GST invoices, and GSTR statutory compliance.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={fetchLedgers}
            disabled={loading}
            className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition cursor-pointer"
            title="Refresh Ledger Balance"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>
          <button
            onClick={() => onNavigateTab("gst_pos")}
            className="px-4 py-2 rounded-xl bg-white hover:bg-neutral-100 text-black text-xs font-bold shadow-md transition apple-press cursor-pointer flex items-center gap-2"
          >
            <Zap className="w-4 h-4 text-black" />
            <span>Launch GST POS</span>
          </button>
        </div>
      </div>

      {/* Statutory Accounting Gateway Voucher Launchers Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {vouchers.map((v) => (
          <div
            key={v.key}
            onClick={v.action}
            className="p-4 rounded-2xl bg-white border border-black/[0.08] hover:border-black hover:shadow-md transition apple-press cursor-pointer flex flex-col justify-between group"
          >
            <div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-black font-mono px-2 py-0.5 rounded-md bg-neutral-100 group-hover:bg-black group-hover:text-white transition">
                  {v.key}
                </span>
                <ArrowRight className="w-4 h-4 text-neutral-300 group-hover:text-black group-hover:translate-x-0.5 transition" />
              </div>
              <h4 className="font-bold text-sm text-black mt-2 leading-tight">
                {v.label}
              </h4>
              <p className="text-xs text-neutral-500 mt-1 line-clamp-2">
                {v.desc}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* GST Duties & Taxes Ledgers Position */}
      {gstr3b && (
        <div className="bg-white rounded-3xl border border-black/[0.08] p-6 shadow-xs space-y-4">
          <div className="flex justify-between items-center border-b border-black/[0.06] pb-3">
            <div className="flex items-center gap-2">
              <Scale className="w-5 h-5 text-black" />
              <h3 className="font-bold text-base text-black">
                GST Duties & Taxes Ledger Position (Current Month)
              </h3>
            </div>
            <span className="text-xs font-mono text-neutral-400">
              Auto-reconciled with Purchase & Sale Vouchers
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Output Tax (Current Liability) */}
            <div className="p-4 rounded-2xl bg-neutral-50 border border-black/[0.06] space-y-2">
              <div className="text-xs font-bold text-neutral-700 flex justify-between items-center">
                <span>Output GST Account (Liability)</span>
                <TrendingUp className="w-4 h-4 text-[#FF3B30]" />
              </div>
              <div className="text-2xl font-black font-mono text-[#FF3B30]">
                ₹{gstr3b.total_tax_payable.toFixed(2)}
              </div>
              <div className="text-[11px] font-mono text-neutral-500 space-y-0.5 pt-1 border-t border-black/[0.04]">
                <div className="flex justify-between">
                  <span>Output IGST:</span>
                  <span>₹{gstr3b.table31.outward_igst.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Output CGST:</span>
                  <span>₹{gstr3b.table31.outward_cgst.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Output SGST:</span>
                  <span>₹{gstr3b.table31.outward_sgst.toFixed(2)}</span>
                </div>
              </div>
            </div>

            {/* Input Tax Credit (Asset) */}
            <div className="p-4 rounded-2xl bg-neutral-50 border border-black/[0.06] space-y-2">
              <div className="text-xs font-bold text-neutral-700 flex justify-between items-center">
                <span>Input Tax Credit (ITC Asset)</span>
                <TrendingDown className="w-4 h-4 text-[#34C759]" />
              </div>
              <div className="text-2xl font-black font-mono text-[#34C759]">
                ₹{gstr3b.total_itc_available.toFixed(2)}
              </div>
              <div className="text-[11px] font-mono text-neutral-500 space-y-0.5 pt-1 border-t border-black/[0.04]">
                <div className="flex justify-between">
                  <span>Input IGST (ITC):</span>
                  <span>₹{gstr3b.table4_itc.itc_igst.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Input CGST (ITC):</span>
                  <span>₹{gstr3b.table4_itc.itc_cgst.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Input SGST (ITC):</span>
                  <span>₹{gstr3b.table4_itc.itc_sgst.toFixed(2)}</span>
                </div>
              </div>
            </div>

            {/* Net Tax Payable in Cash */}
            <div className="p-4 rounded-2xl bg-neutral-50 border border-black/10 space-y-2">
              <div className="text-xs font-bold text-black flex justify-between items-center">
                <span>Net Cash Tax Payable</span>
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
              </div>
              <div className="text-2xl font-black font-mono text-black">
                ₹{gstr3b.net_cash_payable.toFixed(2)}
              </div>
              <div className="text-[11px] font-mono text-neutral-600 space-y-0.5 pt-1 border-t border-black/10">
                <div className="flex justify-between">
                  <span>Net IGST Cash:</span>
                  <span>₹{gstr3b.net_igst_payable.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Net CGST Cash:</span>
                  <span>₹{gstr3b.net_cgst_payable.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Net SGST Cash:</span>
                  <span>₹{gstr3b.net_sgst_payable.toFixed(2)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export const TallyAccountingHub = AccountingHub;
export type TallyAccountingHubProps = AccountingHubProps;
