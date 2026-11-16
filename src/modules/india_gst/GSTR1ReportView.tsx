import React, { useState, useEffect } from "react";
import {
  FileText,
  Download,
  Printer,
  Calendar,
  RefreshCw,
  FileSpreadsheet,
  Building,
  Users,
  Boxes,
} from "lucide-react";
import type { Gstr1ReportData } from "./gstTypes";
import { gstApi } from "./gstApi";
import { generateGstr1PortalJson, generateGstr1Csv } from "./gstUtils";
import { useAppleDialog } from "../../components/common/AppleDialog";

export const GSTR1ReportView: React.FC = () => {
  const today = new Date();
  const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1)
    .toISOString()
    .split("T")[0];
  const lastDayOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0)
    .toISOString()
    .split("T")[0];

  const [startDate, setStartDate] = useState(firstDayOfMonth);
  const [endDate, setEndDate] = useState(lastDayOfMonth);
  const [reportData, setReportData] = useState<Gstr1ReportData | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeSubTab, setActiveSubTab] = useState<"b2b" | "b2cs" | "b2cl" | "hsn" | "docs">("b2b");

  const { alert, toast } = useAppleDialog();

  const loadReport = async () => {
    try {
      setLoading(true);
      const data = await gstApi.getGstr1Report(startDate, endDate);
      setReportData(data);
    } catch (err) {
      alert({
        title: "Report Load Failed",
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

  const handleDownloadJson = () => {
    if (!reportData) return;
    try {
      const jsonStr = generateGstr1PortalJson(reportData);
      const blob = new Blob([jsonStr], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `GSTR1_${reportData.gstin}_${reportData.fp}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast({
        message: "GSTR-1 JSON downloaded. Ready for GST Portal upload!",
        type: "success",
      });
    } catch (e) {
      alert({
        title: "Export Error",
        message: "Failed to generate JSON: " + String(e),
        type: "error",
      });
    }
  };

  const handleDownloadCsv = () => {
    if (!reportData) return;
    try {
      const csvStr = generateGstr1Csv(reportData);
      const blob = new Blob([csvStr], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `GSTR1_Audit_${reportData.gstin}_${reportData.fp}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast({
        message: "GSTR-1 CA Audit CSV downloaded",
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

  return (
    <div className="space-y-6">
      {/* Top Header & Period Control */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-[#1D1D1F]">
              GSTR-1 Audit & Filing Return
            </h1>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#34C759]/10 text-[#34C759] uppercase tracking-wide">
              Official GST Portal Schema
            </span>
          </div>
          <p className="text-xs text-[#86868B] mt-0.5">
            Return for Outward Supplies of Goods & Services under Section 37 of the CGST Act
          </p>
        </div>

        {/* Date Selector & Export Actions */}
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
            onClick={handleDownloadJson}
            disabled={!reportData || loading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#0071E3] hover:bg-[#0077ED] text-white text-xs font-semibold shadow-xs transition apple-press cursor-pointer disabled:opacity-50"
          >
            <Download className="w-3.5 h-3.5" />
            <span>GSTN JSON</span>
          </button>

          <button
            onClick={handleDownloadCsv}
            disabled={!reportData || loading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-black/[0.08] bg-white hover:bg-[#F5F5F7] text-[#1D1D1F] text-xs font-semibold shadow-xs transition apple-press cursor-pointer disabled:opacity-50"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-[#34C759]" />
            <span>Audit CSV</span>
          </button>

          <button
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-black/[0.08] bg-white hover:bg-[#F5F5F7] text-[#1D1D1F] text-xs font-semibold shadow-xs transition apple-press cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      {reportData && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <div className="p-3.5 rounded-2xl bg-white border border-black/[0.06] shadow-xs">
            <div className="text-[11px] font-medium text-neutral-500">Gross Turnover</div>
            <div className="text-base font-bold font-mono text-black mt-0.5">
              ₹{reportData.total_turnover.toFixed(2)}
            </div>
          </div>

          <div className="p-3.5 rounded-2xl bg-white border border-black/[0.06] shadow-xs">
            <div className="text-[11px] font-medium text-neutral-500">Taxable Value</div>
            <div className="text-base font-bold font-mono text-[#0071E3] mt-0.5">
              ₹{reportData.total_taxable.toFixed(2)}
            </div>
          </div>

          <div className="p-3.5 rounded-2xl bg-white border border-black/[0.06] shadow-xs">
            <div className="text-[11px] font-medium text-neutral-500">Integrated (IGST)</div>
            <div className="text-base font-bold font-mono text-[#FF9500] mt-0.5">
              ₹{reportData.total_igst.toFixed(2)}
            </div>
          </div>

          <div className="p-3.5 rounded-2xl bg-white border border-black/[0.06] shadow-xs">
            <div className="text-[11px] font-medium text-neutral-500">Central (CGST)</div>
            <div className="text-base font-bold font-mono text-[#34C759] mt-0.5">
              ₹{reportData.total_cgst.toFixed(2)}
            </div>
          </div>

          <div className="p-3.5 rounded-2xl bg-white border border-black/[0.06] shadow-xs">
            <div className="text-[11px] font-medium text-neutral-500">State (SGST)</div>
            <div className="text-base font-bold font-mono text-[#34C759] mt-0.5">
              ₹{reportData.total_sgst.toFixed(2)}
            </div>
          </div>

          <div className="p-3.5 rounded-2xl bg-white border border-black/[0.06] shadow-xs">
            <div className="text-[11px] font-medium text-neutral-500">Total Tax Liability</div>
            <div className="text-base font-bold font-mono text-[#FF3B30] mt-0.5">
              ₹{(reportData.total_igst + reportData.total_cgst + reportData.total_sgst + reportData.total_cess).toFixed(2)}
            </div>
          </div>
        </div>
      )}

      {/* Segmented Table Selector */}
      <div className="flex items-center gap-1 p-1 bg-white border border-black/[0.06] rounded-2xl shadow-xs overflow-x-auto text-xs">
        <button
          onClick={() => setActiveSubTab("b2b")}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-semibold transition cursor-pointer whitespace-nowrap ${
            activeSubTab === "b2b"
              ? "bg-[#0071E3] text-white shadow-xs"
              : "text-neutral-500 hover:text-black hover:bg-neutral-100"
          }`}
        >
          <Building className="w-3.5 h-3.5" />
          <span>Table 4: B2B Invoices ({reportData?.b2b.length || 0})</span>
        </button>

        <button
          onClick={() => setActiveSubTab("b2cs")}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-semibold transition cursor-pointer whitespace-nowrap ${
            activeSubTab === "b2cs"
              ? "bg-[#0071E3] text-white shadow-xs"
              : "text-neutral-500 hover:text-black hover:bg-neutral-100"
          }`}
        >
          <Users className="w-3.5 h-3.5" />
          <span>Table 7: B2CS Consumer Small ({reportData?.b2cs.length || 0})</span>
        </button>

        <button
          onClick={() => setActiveSubTab("b2cl")}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-semibold transition cursor-pointer whitespace-nowrap ${
            activeSubTab === "b2cl"
              ? "bg-[#0071E3] text-white shadow-xs"
              : "text-neutral-500 hover:text-black hover:bg-neutral-100"
          }`}
        >
          <Building className="w-3.5 h-3.5" />
          <span>Table 5: B2CL Large ({reportData?.b2cl.length || 0})</span>
        </button>

        <button
          onClick={() => setActiveSubTab("hsn")}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-semibold transition cursor-pointer whitespace-nowrap ${
            activeSubTab === "hsn"
              ? "bg-[#0071E3] text-white shadow-xs"
              : "text-neutral-500 hover:text-black hover:bg-neutral-100"
          }`}
        >
          <Boxes className="w-3.5 h-3.5" />
          <span>Table 12: HSN Summary ({reportData?.hsn_summary.length || 0})</span>
        </button>

        <button
          onClick={() => setActiveSubTab("docs")}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-semibold transition cursor-pointer whitespace-nowrap ${
            activeSubTab === "docs"
              ? "bg-[#0071E3] text-white shadow-xs"
              : "text-neutral-500 hover:text-black hover:bg-neutral-100"
          }`}
        >
          <FileText className="w-3.5 h-3.5" />
          <span>Table 13: Documents Issued</span>
        </button>
      </div>

      {/* Table Content */}
      <div className="bg-white rounded-2xl border border-black/[0.06] shadow-xs overflow-hidden">
        {loading ? (
          <div className="py-16 text-center text-xs text-neutral-400">
            <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-[#0071E3]" />
            Compiling GSTR-1 audit registers...
          </div>
        ) : !reportData ? (
          <div className="py-16 text-center text-xs text-neutral-400">
            No data loaded.
          </div>
        ) : (
          <div className="overflow-x-auto">
            {/* SUBTAB 1: TABLE 4 B2B */}
            {activeSubTab === "b2b" && (
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="bg-neutral-50 border-b border-black/[0.08] text-neutral-600 font-semibold text-[11px]">
                    <th className="py-2.5 px-3 text-left">Recipient GSTIN</th>
                    <th className="py-2.5 px-3 text-left">Receiver Name</th>
                    <th className="py-2.5 px-2 text-left font-mono">Invoice #</th>
                    <th className="py-2.5 px-2 text-left">Date</th>
                    <th className="py-2.5 px-2 text-right">Invoice Value</th>
                    <th className="py-2.5 px-2 text-left">POS</th>
                    <th className="py-2.5 px-2 text-right">Taxable</th>
                    <th className="py-2.5 px-2 text-right">IGST</th>
                    <th className="py-2.5 px-2 text-right">CGST</th>
                    <th className="py-2.5 px-3 text-right">SGST</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/[0.04]">
                  {reportData.b2b.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="py-10 text-center text-neutral-400">
                        No registered B2B outward supplies in this period.
                      </td>
                    </tr>
                  ) : (
                    reportData.b2b.map((inv, idx) => (
                      <tr key={idx} className="hover:bg-neutral-50/60 font-mono">
                        <td className="py-2 px-3 font-bold text-[#0071E3]">{inv.customer_gstin}</td>
                        <td className="py-2 px-3 font-sans font-medium text-black">{inv.customer_name}</td>
                        <td className="py-2 px-2 font-bold">{inv.invoice_number}</td>
                        <td className="py-2 px-2 text-neutral-600 font-sans">{inv.invoice_date}</td>
                        <td className="py-2 px-2 text-right font-bold text-black">₹{inv.invoice_value.toFixed(2)}</td>
                        <td className="py-2 px-2 font-sans text-neutral-600">{inv.place_of_supply}</td>
                        <td className="py-2 px-2 text-right font-semibold">₹{inv.taxable_value.toFixed(2)}</td>
                        <td className="py-2 px-2 text-right text-[#FF9500]">₹{inv.igst_amount.toFixed(2)}</td>
                        <td className="py-2 px-2 text-right text-[#34C759]">₹{inv.cgst_amount.toFixed(2)}</td>
                        <td className="py-2 px-3 text-right text-[#34C759]">₹{inv.sgst_amount.toFixed(2)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            )}

            {/* SUBTAB 2: TABLE 7 B2CS */}
            {activeSubTab === "b2cs" && (
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="bg-neutral-50 border-b border-black/[0.08] text-neutral-600 font-semibold text-[11px]">
                    <th className="py-2.5 px-4 text-left">Place of Supply (POS)</th>
                    <th className="py-2.5 px-3 text-center">Tax Rate (%)</th>
                    <th className="py-2.5 px-3 text-right">Taxable Value</th>
                    <th className="py-2.5 px-3 text-right">Integrated Tax (IGST)</th>
                    <th className="py-2.5 px-3 text-right">Central Tax (CGST)</th>
                    <th className="py-2.5 px-4 text-right">State Tax (SGST)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/[0.04]">
                  {reportData.b2cs.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-10 text-center text-neutral-400">
                        No consumer small (B2CS) supplies recorded.
                      </td>
                    </tr>
                  ) : (
                    reportData.b2cs.map((item, idx) => (
                      <tr key={idx} className="hover:bg-neutral-50/60 font-mono">
                        <td className="py-2.5 px-4 font-sans font-semibold text-black">{item.place_of_supply}</td>
                        <td className="py-2.5 px-3 text-center font-bold text-[#0071E3]">{item.tax_rate}%</td>
                        <td className="py-2.5 px-3 text-right font-bold">₹{item.taxable_value.toFixed(2)}</td>
                        <td className="py-2.5 px-3 text-right text-[#FF9500]">₹{item.igst_amount.toFixed(2)}</td>
                        <td className="py-2.5 px-3 text-right text-[#34C759]">₹{item.cgst_amount.toFixed(2)}</td>
                        <td className="py-2.5 px-4 text-right text-[#34C759]">₹{item.sgst_amount.toFixed(2)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            )}

            {/* SUBTAB 3: TABLE 5 B2CL */}
            {activeSubTab === "b2cl" && (
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="bg-neutral-50 border-b border-black/[0.08] text-neutral-600 font-semibold text-[11px]">
                    <th className="py-2.5 px-4 text-left">Receiver Name</th>
                    <th className="py-2.5 px-3 text-left font-mono">Invoice #</th>
                    <th className="py-2.5 px-3 text-left">Date</th>
                    <th className="py-2.5 px-3 text-right">Invoice Value (&gt; ₹2.5L)</th>
                    <th className="py-2.5 px-3 text-left">POS</th>
                    <th className="py-2.5 px-3 text-right">Taxable</th>
                    <th className="py-2.5 px-4 text-right">IGST</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/[0.04]">
                  {reportData.b2cl.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-10 text-center text-neutral-400">
                        Zero interstate consumer invoices exceeding ₹2,50,000 threshold.
                      </td>
                    </tr>
                  ) : (
                    reportData.b2cl.map((inv, idx) => (
                      <tr key={idx} className="hover:bg-neutral-50/60 font-mono">
                        <td className="py-2 px-4 font-sans font-medium text-black">{inv.customer_name}</td>
                        <td className="py-2 px-3 font-bold">{inv.invoice_number}</td>
                        <td className="py-2 px-3 font-sans text-neutral-600">{inv.invoice_date}</td>
                        <td className="py-2 px-3 text-right font-bold text-black">₹{inv.invoice_value.toFixed(2)}</td>
                        <td className="py-2 px-3 font-sans text-neutral-600">{inv.place_of_supply}</td>
                        <td className="py-2 px-3 text-right font-semibold">₹{inv.taxable_value.toFixed(2)}</td>
                        <td className="py-2 px-4 text-right text-[#FF9500]">₹{inv.igst_amount.toFixed(2)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            )}

            {/* SUBTAB 4: TABLE 12 HSN SUMMARY */}
            {activeSubTab === "hsn" && (
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="bg-neutral-50 border-b border-black/[0.08] text-neutral-600 font-semibold text-[11px]">
                    <th className="py-2.5 px-3 text-left font-mono">HSN Code</th>
                    <th className="py-2.5 px-3 text-left">Description</th>
                    <th className="py-2.5 px-2 text-center">UQC</th>
                    <th className="py-2.5 px-2 text-right">Total Qty</th>
                    <th className="py-2.5 px-3 text-right">Total Value</th>
                    <th className="py-2.5 px-3 text-right">Taxable Value</th>
                    <th className="py-2.5 px-2 text-right">IGST</th>
                    <th className="py-2.5 px-2 text-right">CGST</th>
                    <th className="py-2.5 px-3 text-right">SGST</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/[0.04]">
                  {reportData.hsn_summary.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-10 text-center text-neutral-400">
                        No HSN summary data available for this date range.
                      </td>
                    </tr>
                  ) : (
                    reportData.hsn_summary.map((hsn, idx) => (
                      <tr key={idx} className="hover:bg-neutral-50/60 font-mono">
                        <td className="py-2.5 px-3 font-bold text-[#0071E3]">{hsn.hsn_code}</td>
                        <td className="py-2.5 px-3 font-sans font-medium text-black">{hsn.description}</td>
                        <td className="py-2.5 px-2 text-center text-neutral-500 font-bold">{hsn.uqc}</td>
                        <td className="py-2.5 px-2 text-right">{hsn.total_quantity}</td>
                        <td className="py-2.5 px-3 text-right font-bold text-black">₹{hsn.total_value.toFixed(2)}</td>
                        <td className="py-2.5 px-3 text-right font-semibold">₹{hsn.taxable_value.toFixed(2)}</td>
                        <td className="py-2.5 px-2 text-right text-[#FF9500]">₹{hsn.igst_amount.toFixed(2)}</td>
                        <td className="py-2.5 px-2 text-right text-[#34C759]">₹{hsn.cgst_amount.toFixed(2)}</td>
                        <td className="py-2.5 px-3 text-right text-[#34C759]">₹{hsn.sgst_amount.toFixed(2)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            )}

            {/* SUBTAB 5: TABLE 13 DOCS ISSUED */}
            {activeSubTab === "docs" && (
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="bg-neutral-50 border-b border-black/[0.08] text-neutral-600 font-semibold text-[11px]">
                    <th className="py-2.5 px-4 text-left">Document Nature</th>
                    <th className="py-2.5 px-3 text-left font-mono">From Serial #</th>
                    <th className="py-2.5 px-3 text-left font-mono">To Serial #</th>
                    <th className="py-2.5 px-3 text-center">Total Issued</th>
                    <th className="py-2.5 px-3 text-center">Cancelled</th>
                    <th className="py-2.5 px-4 text-center font-bold">Net Valid</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/[0.04]">
                  {reportData.doc_summary.map((doc, idx) => (
                    <tr key={idx} className="hover:bg-neutral-50/60 font-mono">
                      <td className="py-3 px-4 font-sans font-medium text-black">{doc.doc_type}</td>
                      <td className="py-3 px-3 font-bold">{doc.from_serial}</td>
                      <td className="py-3 px-3 font-bold">{doc.to_serial}</td>
                      <td className="py-3 px-3 text-center">{doc.total_count}</td>
                      <td className="py-3 px-3 text-center text-neutral-400">{doc.cancelled_count}</td>
                      <td className="py-3 px-4 text-center font-bold text-[#34C759]">{doc.net_count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
