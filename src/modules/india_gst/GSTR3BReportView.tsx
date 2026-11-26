import React, { useState, useEffect } from "react";
import {
  Printer,
  Calendar,
  RefreshCw,
  FileSpreadsheet,
  FileText,
  TrendingDown,
  TrendingUp,
  Scale,
} from "lucide-react";
import type { Gstr3bReportData } from "./gstTypes";
import { gstApi } from "./gstApi";
import { generateGstr3bCsv } from "./gstUtils";
import { buildGstr3bPdf } from "./gstPdfReports";
import { printPdfDocument } from "../../utils/printPdf";
import { formatLocalDate } from "../../utils/dateUtils";
import { useAppleDialog } from "../../components/common/AppleDialog";

export const GSTR3BReportView: React.FC = () => {
  const today = new Date();
  const firstDayOfMonth = formatLocalDate(new Date(today.getFullYear(), today.getMonth(), 1));
  const lastDayOfMonth = formatLocalDate(new Date(today.getFullYear(), today.getMonth() + 1, 0));

  const [startDate, setStartDate] = useState(firstDayOfMonth);
  const [endDate, setEndDate] = useState(lastDayOfMonth);
  const [reportData, setReportData] = useState<Gstr3bReportData | null>(null);
  const [loading, setLoading] = useState(false);

  const { alert, toast } = useAppleDialog();

  const loadReport = async () => {
    try {
      setLoading(true);
      const data = await gstApi.getGstr3bReport(startDate, endDate);
      setReportData(data);
    } catch (err) {
      alert({
        title: "Report Error",
        message: String(err),
        type: "error",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReport();
  }, [startDate, endDate]);

  const handleDownloadCsv = () => {
    if (!reportData) return;
    try {
      const csvStr = generateGstr3bCsv(reportData);
      const blob = new Blob([csvStr], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `GSTR3B_Return_${reportData.gstin}_${reportData.fp}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast({
        message: "GSTR-3B Return CSV downloaded",
        type: "success",
      });
    } catch (e) {
      alert({
        title: "Export Error",
        message: "Failed to generate CSV: " + String(e),
        type: "error",
      });
    }
  };

  const handleSavePdf = () => {
    if (!reportData) return;
    try {
      const pdf = buildGstr3bPdf(reportData);
      pdf.save(`GSTR3B_Return_${reportData.gstin || "REPORT"}_${reportData.fp}.pdf`);
      toast({
        message: "GSTR-3B Statutory Return PDF saved",
        type: "success",
      });
    } catch (e) {
      alert({
        title: "PDF Export Error",
        message: "Failed to generate PDF: " + String(e),
        type: "error",
      });
    }
  };

  const handlePrintReturn = async () => {
    if (!reportData) return;
    try {
      const pdf = buildGstr3bPdf(reportData);
      const ok = await printPdfDocument(pdf);
      if (!ok) {
        alert({
          title: "Print Error",
          message: "Unable to open PDF print spooler. Please use Save PDF instead.",
          type: "error",
        });
      }
    } catch (e) {
      alert({
        title: "Print Error",
        message: "Failed to prepare GSTR-3B print return: " + String(e),
        type: "error",
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-[#1D1D1F]">
              GSTR-3B Monthly Self-Declaration Return
            </h1>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-black/5 text-black uppercase tracking-wide">
              Rule 61(5) CGST Act
            </span>
          </div>
          <p className="text-xs text-[#86868B] mt-0.5">
            Summary Return of Outward Supplies, Input Tax Credit (ITC) & Net Cash Tax Payable
          </p>
        </div>

        {/* Date Selector & Actions */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 bg-white border border-black/[0.08] rounded-xl px-2.5 py-1 text-xs">
            <Calendar className="w-3.5 h-3.5 text-neutral-400" />
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="font-mono text-neutral-700 focus:outline-hidden"
            />
            <span className="text-neutral-400">to</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="font-mono text-neutral-700 focus:outline-hidden"
            />
          </div>

          <button
            onClick={loadReport}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border border-black/[0.08] bg-white hover:bg-[#F5F5F7] text-[#1D1D1F] text-xs font-semibold shadow-xs transition cursor-pointer disabled:opacity-50"
            title="Refresh Return Data"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          </button>

          <button
            onClick={handleDownloadCsv}
            disabled={!reportData || loading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-black/[0.08] bg-white hover:bg-[#F5F5F7] text-[#1D1D1F] text-xs font-semibold shadow-xs transition apple-press cursor-pointer disabled:opacity-50"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-[#34C759]" />
            <span>Export CSV</span>
          </button>

          <button
            onClick={handleSavePdf}
            disabled={!reportData || loading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-black/[0.08] bg-white hover:bg-[#F5F5F7] text-[#1D1D1F] text-xs font-semibold shadow-xs transition apple-press cursor-pointer disabled:opacity-50"
          >
            <FileText className="w-3.5 h-3.5 text-[#FF3B30]" />
            <span>Save PDF</span>
          </button>

          <button
            onClick={handlePrintReturn}
            disabled={!reportData || loading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-black/[0.08] bg-white hover:bg-[#F5F5F7] text-[#1D1D1F] text-xs font-semibold shadow-xs transition apple-press cursor-pointer disabled:opacity-50"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print Return</span>
          </button>
        </div>
      </div>

      {/* Tax Settlement Summary Cards */}
      {reportData && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="p-4 rounded-2xl bg-white border border-black/[0.06] shadow-xs">
            <div className="flex items-center justify-between text-neutral-500 mb-1">
              <span className="text-xs font-medium">1. Gross Outward Tax Liability</span>
              <TrendingUp className="w-4 h-4 text-[#FF3B30]" />
            </div>
            <div className="text-2xl font-bold font-mono text-[#FF3B30]">
              ₹{reportData.total_tax_payable.toFixed(2)}
            </div>
            <div className="text-[10px] text-neutral-400 mt-1 font-mono">
              IGST: ₹{reportData.table31.outward_igst.toFixed(2)} · CGST+SGST: ₹{(reportData.table31.outward_cgst + reportData.table31.outward_sgst).toFixed(2)}
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-white border border-black/[0.06] shadow-xs">
            <div className="flex items-center justify-between text-neutral-500 mb-1">
              <span className="text-xs font-medium">2. Eligible Input Tax Credit (ITC)</span>
              <TrendingDown className="w-4 h-4 text-[#34C759]" />
            </div>
            <div className="text-2xl font-bold font-mono text-[#34C759]">
              ₹{reportData.total_itc_available.toFixed(2)}
            </div>
            <div className="text-[10px] text-neutral-400 mt-1 font-mono">
              From inward purchase vouchers eligible for set-off
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-white border border-black/[0.06] shadow-xs">
            <div className="flex items-center justify-between text-neutral-500 mb-1">
              <span className="text-xs font-medium">3. Net Tax Payable in Cash</span>
              <Scale className="w-4 h-4 text-black" />
            </div>
            <div className="text-2xl font-bold font-mono text-black">
              ₹{reportData.net_cash_payable.toFixed(2)}
            </div>
            <div className="text-[10px] text-neutral-400 mt-1">
              Amount to deposit in Electronic Cash Ledger via Challan
            </div>
          </div>
        </div>
      )}

      {/* Main Return Tables */}
      <div className="space-y-6">
        {/* Table 3.1: Outward Supplies */}
        <div className="bg-white rounded-2xl border border-black/[0.06] shadow-xs overflow-hidden">
          <div className="px-5 py-3.5 bg-neutral-50 border-b border-black/[0.06] flex items-center justify-between">
            <div className="font-bold text-xs text-black uppercase tracking-wide">
              3.1 Details of Outward Supplies & Inward Liable to Reverse Charge
            </div>
            <span className="text-[10px] font-mono text-neutral-400">Values in ₹ INR</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-[#FAFAFA] border-b border-black/[0.06] text-neutral-600 font-semibold text-[10px]">
                <tr>
                  <th className="py-2.5 px-4 text-left">Nature of Supplies</th>
                  <th className="py-2.5 px-3 text-right">Total Taxable Value</th>
                  <th className="py-2.5 px-3 text-right">Integrated Tax (IGST)</th>
                  <th className="py-2.5 px-3 text-right">Central Tax (CGST)</th>
                  <th className="py-2.5 px-3 text-right">State/UT Tax (SGST)</th>
                  <th className="py-2.5 px-4 text-right">Cess</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/[0.04] font-mono">
                {reportData && (
                  <>
                    <tr className="hover:bg-neutral-50">
                      <td className="py-3 px-4 font-sans font-medium text-black">
                        (a) Outward taxable supplies (other than zero rated, nil rated & exempted)
                      </td>
                      <td className="py-3 px-3 text-right font-bold text-black">
                        ₹{reportData.table31.outward_taxable_value.toFixed(2)}
                      </td>
                      <td className="py-3 px-3 text-right text-[#FF9500]">
                        ₹{reportData.table31.outward_igst.toFixed(2)}
                      </td>
                      <td className="py-3 px-3 text-right text-[#34C759]">
                        ₹{reportData.table31.outward_cgst.toFixed(2)}
                      </td>
                      <td className="py-3 px-3 text-right text-[#34C759]">
                        ₹{reportData.table31.outward_sgst.toFixed(2)}
                      </td>
                      <td className="py-3 px-4 text-right">
                        ₹{reportData.table31.outward_cess.toFixed(2)}
                      </td>
                    </tr>
                    <tr className="hover:bg-neutral-50 text-neutral-500">
                      <td className="py-2 px-4 font-sans">(b) Outward taxable supplies (zero rated exports / SEZ)</td>
                      <td className="py-2 px-3 text-right">₹0.00</td>
                      <td className="py-2 px-3 text-right">₹0.00</td>
                      <td className="py-2 px-3 text-right">-</td>
                      <td className="py-2 px-3 text-right">-</td>
                      <td className="py-2 px-4 text-right">₹0.00</td>
                    </tr>
                    <tr className="hover:bg-neutral-50 text-neutral-500">
                      <td className="py-2 px-4 font-sans">(c) Other outward supplies (nil rated, exempted)</td>
                      <td className="py-2 px-3 text-right">₹0.00</td>
                      <td className="py-2 px-3 text-right">-</td>
                      <td className="py-2 px-3 text-right">-</td>
                      <td className="py-2 px-3 text-right">-</td>
                      <td className="py-2 px-4 text-right">-</td>
                    </tr>
                    <tr className="hover:bg-neutral-50 text-neutral-500">
                      <td className="py-2 px-4 font-sans">(d) Inward supplies liable to reverse charge (RCM)</td>
                      <td className="py-2 px-3 text-right">₹0.00</td>
                      <td className="py-2 px-3 text-right">₹0.00</td>
                      <td className="py-2 px-3 text-right">₹0.00</td>
                      <td className="py-2 px-3 text-right">₹0.00</td>
                      <td className="py-2 px-4 text-right">₹0.00</td>
                    </tr>
                  </>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Table 4: Eligible ITC */}
        <div className="bg-white rounded-2xl border border-black/[0.06] shadow-xs overflow-hidden">
          <div className="px-5 py-3.5 bg-neutral-50 border-b border-black/[0.06] flex items-center justify-between">
            <div className="font-bold text-xs text-black uppercase tracking-wide">
              4. Eligible Input Tax Credit (ITC Available)
            </div>
            <span className="text-[10px] font-mono text-neutral-400">Values in ₹ INR</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-[#FAFAFA] border-b border-black/[0.06] text-neutral-600 font-semibold text-[10px]">
                <tr>
                  <th className="py-2.5 px-4 text-left">Details of Inward Supplies / ITC</th>
                  <th className="py-2.5 px-3 text-right">Integrated Tax (IGST)</th>
                  <th className="py-2.5 px-3 text-right">Central Tax (CGST)</th>
                  <th className="py-2.5 px-3 text-right">State/UT Tax (SGST)</th>
                  <th className="py-2.5 px-4 text-right">Cess</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/[0.04] font-mono">
                {reportData && (
                  <tr className="hover:bg-neutral-50">
                    <td className="py-3 px-4 font-sans font-medium text-black">
                      (A)(5) All other ITC (Inward B2B Purchase Bills from Registered Vendors)
                    </td>
                    <td className="py-3 px-3 text-right font-bold text-[#FF9500]">
                      ₹{reportData.table4_itc.itc_igst.toFixed(2)}
                    </td>
                    <td className="py-3 px-3 text-right font-bold text-[#34C759]">
                      ₹{reportData.table4_itc.itc_cgst.toFixed(2)}
                    </td>
                    <td className="py-3 px-3 text-right font-bold text-[#34C759]">
                      ₹{reportData.table4_itc.itc_sgst.toFixed(2)}
                    </td>
                    <td className="py-3 px-4 text-right">
                      ₹{reportData.table4_itc.itc_cess.toFixed(2)}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Table 6.1: Payment of Tax */}
        <div className="bg-white rounded-2xl border border-black/[0.06] shadow-xs overflow-hidden">
          <div className="px-5 py-3.5 bg-neutral-50 border-b border-black/[0.06] flex items-center justify-between">
            <div className="font-bold text-xs text-black uppercase tracking-wide">
              6.1 Payment of Tax (Net Liability Computation)
            </div>
            <span className="text-[10px] font-mono text-neutral-400">Values in ₹ INR</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-[#FAFAFA] border-b border-black/[0.06] text-neutral-600 font-semibold text-[10px]">
                <tr>
                  <th className="py-2.5 px-4 text-left">Description</th>
                  <th className="py-2.5 px-3 text-right">Total Tax Payable (3.1)</th>
                  <th className="py-2.5 px-3 text-right">ITC Utilized (4)</th>
                  <th className="py-2.5 px-4 text-right font-bold text-black">Tax Payable in Cash</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/[0.04] font-mono">
                {reportData && (
                  <>
                    <tr className="hover:bg-neutral-50">
                      <td className="py-2.5 px-4 font-sans font-medium text-black">Integrated Tax (IGST)</td>
                      <td className="py-2.5 px-3 text-right">₹{reportData.table31.outward_igst.toFixed(2)}</td>
                      <td className="py-2.5 px-3 text-right text-[#34C759]">₹{reportData.itc_utilized_igst.toFixed(2)}</td>
                      <td className="py-2.5 px-4 text-right font-bold text-black">₹{reportData.net_igst_payable.toFixed(2)}</td>
                    </tr>
                    <tr className="hover:bg-neutral-50">
                      <td className="py-2.5 px-4 font-sans font-medium text-black">Central Tax (CGST)</td>
                      <td className="py-2.5 px-3 text-right">₹{reportData.table31.outward_cgst.toFixed(2)}</td>
                      <td className="py-2.5 px-3 text-right text-[#34C759]">₹{reportData.itc_utilized_cgst.toFixed(2)}</td>
                      <td className="py-2.5 px-4 text-right font-bold text-black">₹{reportData.net_cgst_payable.toFixed(2)}</td>
                    </tr>
                    <tr className="hover:bg-neutral-50">
                      <td className="py-2.5 px-4 font-sans font-medium text-black">State/UT Tax (SGST)</td>
                      <td className="py-2.5 px-3 text-right">₹{reportData.table31.outward_sgst.toFixed(2)}</td>
                      <td className="py-2.5 px-3 text-right text-[#34C759]">₹{reportData.itc_utilized_sgst.toFixed(2)}</td>
                      <td className="py-2.5 px-4 text-right font-bold text-black">₹{reportData.net_sgst_payable.toFixed(2)}</td>
                    </tr>
                    <tr className="hover:bg-neutral-50">
                      <td className="py-2.5 px-4 font-sans font-medium text-black">Cess</td>
                      <td className="py-2.5 px-3 text-right">₹{reportData.table31.outward_cess.toFixed(2)}</td>
                      <td className="py-2.5 px-3 text-right text-[#34C759]">₹{reportData.itc_utilized_cess.toFixed(2)}</td>
                      <td className="py-2.5 px-4 text-right font-bold text-black">₹{reportData.net_cess_payable.toFixed(2)}</td>
                    </tr>
                    <tr className="bg-neutral-50 font-bold border-t-2 border-black">
                      <td className="py-3 px-4 font-sans text-black">TOTAL NET PAYABLE IN CASH</td>
                      <td className="py-3 px-3 text-right">₹{reportData.total_tax_payable.toFixed(2)}</td>
                      <td className="py-3 px-3 text-right text-[#34C759]">₹{reportData.total_itc_utilized.toFixed(2)}</td>
                      <td className="py-3 px-4 text-right text-base text-black">₹{reportData.net_cash_payable.toFixed(2)}</td>
                    </tr>
                  </>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
