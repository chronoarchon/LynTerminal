import React, { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import {
  Printer,
  FileDown,
  X,
  CheckCircle2,
  FileText,
  Receipt as ReceiptIcon,
  Copy,
  Check,
} from "lucide-react";
import { jsPDF } from "jspdf";
import { safeHtml2Canvas } from "../utils/safeHtml2Canvas";
import { printPdfDocument } from "../utils/printPdf";
import type { InvoiceDetail, Settings } from "../types";
import { api } from "../services/api";
import { useAppleDialog } from "./common/AppleDialog";
import { useCurrency } from "../context/CurrencyContext";

interface InvoiceDocModalProps {
  invoiceDetail: InvoiceDetail;
  settings: Settings;
  onClose: () => void;
}

export const InvoiceDocModal: React.FC<InvoiceDocModalProps> = ({
  invoiceDetail,
  settings,
  onClose,
}) => {
  const { invoice, items } = invoiceDetail;
  const { formatCurrency } = useCurrency();
  const [docFormat, setDocFormat] = useState<"thermal" | "standard">("thermal");
  const [copyType, setCopyType] = useState<
    "ORIGINAL FOR RECIPIENT" | "DUPLICATE FOR TRANSPORTER" | "TRIPLICATE FOR SUPPLIER"
  >("ORIGINAL FOR RECIPIENT");
  const [copied, setCopied] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [customLogo] = useState<string | null>(() => {
    if (typeof window !== "undefined") {
      return (
        localStorage.getItem("lynterminal_custom_logo") ||
        localStorage.getItem("lyndesk_custom_logo")
      );
    }
    return null;
  });
  const docRef = useRef<HTMLDivElement>(null);
  const { alert, toast } = useAppleDialog();

  const handleCopyNumber = () => {
    navigator.clipboard.writeText(invoice.invoice_number);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const generatePdfObject = async (): Promise<jsPDF | null> => {
    if (!docRef.current) return null;
    const element = docRef.current;
    const canvas = await safeHtml2Canvas(element, {
      scale: 2,
      useCORS: true,
      logging: false,
      backgroundColor: "#FFFFFF",
      scrollY: 0,
      scrollX: 0,
    });

    let pdf: jsPDF;

    if (docFormat === "thermal") {
      // Continuous thermal slip format (exact height of items)
      const imgWidth = 80;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      pdf = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: [imgWidth, Math.max(80, imgHeight + 4)],
      });
      const imgData = canvas.toDataURL("image/png");
      pdf.addImage(imgData, "PNG", 0, 2, imgWidth, imgHeight);
    } else {
      // A4 Commercial Tax Invoice format (210mm x 297mm)
      pdf = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
      });

      const pageWidth = 210;
      const pageHeight = 297;
      const margin = 10;
      const printWidth = pageWidth - margin * 2;
      const printHeight = (canvas.height * printWidth) / canvas.width;
      const imgData = canvas.toDataURL("image/png");

      if (printHeight <= pageHeight - margin * 2) {
        pdf.addImage(imgData, "PNG", margin, margin, printWidth, printHeight);
      } else {
        // Multi-page slicing for bills with many line items
        let heightLeft = printHeight;
        let position = margin;
        let page = 1;
        const usableHeight = pageHeight - margin * 2;

        while (heightLeft > 0) {
          if (page > 1) {
            pdf.addPage();
          }
          pdf.addImage(imgData, "PNG", margin, position, printWidth, printHeight);
          heightLeft -= usableHeight;
          position -= usableHeight;
          page++;
        }
      }
    }
    return pdf;
  };

  const handlePrint = async () => {
    try {
      setIsExporting(true);
      const pdf = await generatePdfObject();
      if (pdf) {
        const printed = await printPdfDocument(pdf);
        if (printed) return;
      }
      // Fallback to DOM print isolation
      document.body.classList.add("printing-doc");
      window.print();
      setTimeout(() => {
        document.body.classList.remove("printing-doc");
      }, 1000);
    } catch {
      document.body.classList.add("printing-doc");
      window.print();
      setTimeout(() => {
        document.body.classList.remove("printing-doc");
      }, 1000);
    } finally {
      setIsExporting(false);
    }
  };

  useEffect(() => {
    const handleAfterPrint = () => {
      document.body.classList.remove("printing-doc");
    };
    window.addEventListener("afterprint", handleAfterPrint);
    return () => window.removeEventListener("afterprint", handleAfterPrint);
  }, []);

  const handleExportPdf = async () => {
    if (!docRef.current) return;
    try {
      setIsExporting(true);

      // 1. Generate & save genuine native vector PDF through Rust backend
      let savedPath = "";
      try {
        savedPath = await api.exportInvoicePdf(invoice.id);
      } catch (err) {
        console.warn("Backend vector PDF export fallback to canvas:", err);
      }

      // 2. Client-side canvas export for browser download & verification
      const pdf = await generatePdfObject();
      if (!pdf) throw new Error("Could not synthesize invoice layout");

      // If backend save didn't return a path, persist the client bytes directly
      if (!savedPath) {
        const arrayBuffer = pdf.output("arraybuffer");
        const uint8Array = new Uint8Array(arrayBuffer);
        savedPath = await api.saveInvoicePdfFile(invoice.invoice_number, uint8Array);
      }

      // Trigger browser download
      pdf.save(`${invoice.invoice_number}.pdf`);

      toast({
        message: `Tax Invoice PDF saved to ${savedPath}`,
        type: "success",
      });
    } catch (e) {
      alert({
        title: "PDF Export Error",
        message: "Failed to generate PDF: " + String(e),
        type: "error",
      });
    } finally {
      setIsExporting(false);
    }
  };

  const modalContent = (
    <div id="invoice-modal-portal">
      <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 md:p-6 overflow-y-auto">
      <div className="bg-white text-black rounded-3xl shadow-2xl w-full max-w-4xl border border-black/[0.08] overflow-hidden flex flex-col max-h-[94vh] animate-in fade-in zoom-in-95 duration-150 lux-modal-card">
        
        {/* Top Control Bar (Hidden when printing) */}
        <div className="px-5 py-3.5 bg-[#F9FAFB] border-b border-black/[0.08] no-print shrink-0 text-black">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-8 h-8 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-200/60 flex items-center justify-center shrink-0">
                <CheckCircle2 className="w-4 h-4 stroke-[2.5]" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-extrabold text-black font-mono">
                    {invoice.invoice_number}
                  </span>
                  <button
                    onClick={handleCopyNumber}
                    title="Copy Invoice Number"
                    className="text-neutral-400 hover:text-black transition cursor-pointer p-0.5"
                  >
                    {copied ? (
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </button>
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200/50 uppercase">
                    {invoice.status}
                  </span>
                </div>
                <span className="text-[11px] text-neutral-500 font-mono truncate block">
                  {invoice.invoice_date} · {invoice.payment_method}
                </span>
              </div>
            </div>

            {/* Controls Toolbar (Always Aligned, Never Wrapping Close Button into Center) */}
            <div className="flex items-center gap-2 shrink-0">
              <select
                value={copyType}
                onChange={(e) => setCopyType(e.target.value as any)}
                className="text-xs bg-white border border-black/[0.1] rounded-xl px-2.5 py-1.5 font-bold text-black focus:outline-none focus:border-black cursor-pointer shadow-2xs"
              >
                <option value="ORIGINAL FOR RECIPIENT">Original (Recipient)</option>
                <option value="DUPLICATE FOR TRANSPORTER">Duplicate (Transporter)</option>
                <option value="TRIPLICATE FOR SUPPLIER">Triplicate (Supplier)</option>
              </select>

              <div className="flex items-center p-0.5 rounded-xl bg-neutral-100 border border-black/[0.06] text-xs">
                <button
                  onClick={() => setDocFormat("thermal")}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                    docFormat === "thermal"
                      ? "bg-white text-black shadow-xs"
                      : "text-neutral-500 hover:text-black"
                  }`}
                >
                  <ReceiptIcon className="w-3.5 h-3.5" />
                  <span>80mm</span>
                </button>
                <button
                  onClick={() => setDocFormat("standard")}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                    docFormat === "standard"
                      ? "bg-white text-black shadow-xs"
                      : "text-neutral-500 hover:text-black"
                  }`}
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>A4</span>
                </button>
              </div>

              <button
                onClick={handleExportPdf}
                disabled={isExporting}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-black/[0.1] bg-white hover:bg-neutral-50 text-black text-xs font-bold transition active:scale-95 cursor-pointer disabled:opacity-50 shadow-2xs"
              >
                <FileDown className="w-3.5 h-3.5" />
                <span>{isExporting ? "..." : "PDF"}</span>
              </button>

              <button
                onClick={handlePrint}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-[#0071E3] hover:bg-[#0077ED] text-white text-xs font-bold uppercase tracking-wider shadow-sm transition active:scale-95 cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print</span>
              </button>

              <div className="pl-1 border-l border-black/[0.1] ml-0.5">
                <button
                  onClick={onClose}
                  className="w-8 h-8 rounded-full text-neutral-400 hover:text-black hover:bg-black/5 flex items-center justify-center transition cursor-pointer"
                  title="Close preview"
                  aria-label="Close"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Scrollable Document Area with Clean Light Canvas */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-8 pb-20 bg-[#F5F5F7]">
          
          {/* FORMAT 1: 80mm Thermal Receipt (Counter POS Slip) */}
          {docFormat === "thermal" && (
            <div
              ref={docRef}
              data-printable="true"
              className="mx-auto w-[360px] max-w-full bg-white p-6 sm:p-8 pb-10 rounded-2xl shadow-lg border border-black/[0.08] text-[#1D1D1F] font-mono text-xs space-y-4 select-text thermal-receipt my-2"
            >
              {/* Header branding */}
              <div className="text-center space-y-1 pb-3 border-b border-solid border-black/15">
                {customLogo ? (
                  <div className="flex justify-center pb-1">
                    <img
                      src={customLogo}
                      alt="Store Logo"
                      className="max-h-12 max-w-[120px] object-contain"
                    />
                  </div>
                ) : (
                  <div className="flex justify-center pb-1">
                    <div className="w-10 h-10 rounded-xl bg-[#18191E] text-white flex items-center justify-center font-bold text-lg">
                      {settings.business_name ? settings.business_name.charAt(0).toUpperCase() : "L"}
                    </div>
                  </div>
                )}
                <div className="text-[9px] font-bold font-mono px-2 py-0.5 rounded bg-black/5 uppercase text-black border border-black/10 inline-block mb-1">
                  {copyType}
                </div>
                <div className="font-bold text-base tracking-tight font-sans text-black">
                  {settings.business_name || "LynTerminal Store"}
                </div>
                {settings.tagline && (
                  <div className="text-[10px] text-neutral-500 font-sans">
                    {settings.tagline}
                  </div>
                )}
                {settings.address && (
                  <div className="text-[10px] text-neutral-500">
                    {settings.address}
                  </div>
                )}
                {settings.phone && (
                  <div className="text-[10px] text-neutral-500">
                    Tel: {settings.phone}
                  </div>
                )}
                {settings.tax_id && (
                  <div className="text-[10px] text-neutral-500">
                    {settings.tax_name}: {settings.tax_id}
                  </div>
                )}
              </div>

              {/* Meta details */}
              <div className="space-y-1 text-[11px] pb-3 border-b border-solid border-black/15">
                <div className="flex justify-between">
                  <span className="text-neutral-500">RECEIPT #:</span>
                  <span className="font-bold font-mono text-black">{invoice.invoice_number}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-500">DATE:</span>
                  <span>{invoice.invoice_date}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-500">CUSTOMER:</span>
                  <span className="font-semibold truncate max-w-[170px] text-right">
                    {invoice.party_name || "Walk-in Customer"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-500">METHOD:</span>
                  <span>{invoice.payment_method}</span>
                </div>
                {invoice.reference && (
                  <div className="flex justify-between">
                    <span className="text-neutral-500">REF:</span>
                    <span className="font-mono">{invoice.reference}</span>
                  </div>
                )}
              </div>

              {/* Itemized list */}
              <div className="space-y-1 py-1">
                <div className="flex justify-between text-[10px] font-bold text-neutral-500 pb-1.5 border-b border-solid border-black/15">
                  <span>ITEM / QTY</span>
                  <span>AMOUNT</span>
                </div>
                {items.map((item, idx) => (
                  <div
                    key={item.id || idx}
                    className="space-y-0.5 py-1.5 border-b border-solid border-black/10 last:border-0"
                  >
                    <div className="font-medium text-[11px] text-black leading-snug break-words">
                      {item.item_name}
                    </div>
                    <div className="flex justify-between items-center text-[11px] text-neutral-600">
                      <span className="shrink-0">
                        {item.quantity} {item.unit} × {formatCurrency(item.unit_price)}
                      </span>
                      <span className="font-bold text-black font-mono shrink-0 ml-2">
                        {formatCurrency(item.line_total)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Totals Breakdown */}
              <div className="space-y-1.5 pt-3 border-t border-solid border-black/15 text-xs">
                <div className="flex justify-between text-neutral-600">
                  <span>Subtotal:</span>
                  <span className="font-mono">
                    {formatCurrency(invoice.subtotal)}
                  </span>
                </div>
                {invoice.discount_amount > 0 && (
                  <div className="flex justify-between text-neutral-600">
                    <span>Discount:</span>
                    <span className="font-mono">
                      -{formatCurrency(invoice.discount_amount)}
                    </span>
                  </div>
                )}
                <div className="flex justify-between text-neutral-600">
                  <span>{settings.tax_name || "Sales Tax"}:</span>
                  <span className="font-mono">
                    +{formatCurrency(invoice.tax_amount)}
                  </span>
                </div>
                <div className="flex justify-between font-bold text-sm text-black pt-1 border-t border-solid border-black/20">
                  <span>TOTAL:</span>
                  <span className="text-base font-mono">
                    {formatCurrency(invoice.total_amount)}
                  </span>
                </div>
                <div className="flex justify-between text-[11px] text-neutral-600 pt-0.5">
                  <span>Cash Received:</span>
                  <span className="font-mono">
                    {formatCurrency(invoice.paid_amount)}
                  </span>
                </div>
              </div>

              {/* Footer Terms */}
              <div className="text-center text-[10px] text-neutral-500 space-y-1 pt-2 font-sans border-t border-solid border-black/15">
                <p>
                  {settings.terms_and_conditions ||
                    "Thank you for visiting! Returns accepted within 14 days with original receipt."}
                </p>
                <div className="text-[9px] text-neutral-400 font-mono tracking-widest pt-1">
                  *** VERIFIED LOCAL TRANSACTION ***
                </div>
              </div>
            </div>
          )}

          {/* FORMAT 2: Apple-style Minimalist Standard A4 Commercial Invoice */}
          {docFormat === "standard" && (
            <div
              ref={docRef}
              data-printable="true"
              className="mx-auto w-full max-w-2xl bg-white p-8 sm:p-10 pb-12 rounded-3xl shadow-lg border border-black/[0.08] text-[#1D1D1F] select-text my-2"
            >
              {/* Top Business & Invoice Title */}
              <div className="flex justify-between items-start pb-6 border-b border-black/[0.08]">
                <div className="flex items-start gap-4">
                  {customLogo ? (
                    <img
                      src={customLogo}
                      alt="Store Logo"
                      className="w-14 h-14 rounded-2xl object-contain border border-black/10 shrink-0 p-1 bg-white shadow-2xs"
                    />
                  ) : (
                    <div className="w-14 h-14 rounded-2xl border border-black/10 shrink-0 p-1 bg-[#18191E] text-white flex items-center justify-center font-bold text-2xl shadow-2xs">
                      {settings.business_name ? settings.business_name.charAt(0).toUpperCase() : "L"}
                    </div>
                  )}
                  <div>
                    <h1 className="text-2xl font-bold tracking-tight text-[#1D1D1F]">
                      {settings.business_name || "LynTerminal Store"}
                    </h1>
                    <p className="text-xs text-[#86868B] mt-0.5">
                      {settings.tagline || "Commercial Retail & Management"}
                    </p>
                    <div className="text-xs text-[#86868B] mt-2 space-y-0.5">
                      {settings.address && <div>{settings.address}</div>}
                      {settings.phone && <div>Tel: {settings.phone}</div>}
                      {settings.email && <div>Email: {settings.email}</div>}
                      {settings.tax_id && (
                        <div>
                          {settings.tax_name}: {settings.tax_id}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="text-right">
                  <div className="text-[10px] font-bold font-mono px-2 py-0.5 rounded bg-black/5 uppercase text-black border border-black/10 inline-block mb-1">
                    {copyType}
                  </div>
                  <div className="text-xl font-bold text-[#1D1D1F] tracking-tight">
                    TAX INVOICE
                  </div>
                  <div className="text-xs font-mono font-bold text-black mt-1">
                    {invoice.invoice_number}
                  </div>
                  <div className="text-xs text-[#86868B] mt-1">
                    Date: {invoice.invoice_date}
                  </div>
                  <div className="text-xs text-[#86868B] mt-0.5">
                    Status: <span className="font-bold text-emerald-600">{invoice.status}</span>
                  </div>
                </div>
              </div>

              {/* Bill To */}
              <div className="py-5 border-b border-black/[0.08]">
                <div className="text-[11px] font-semibold text-[#86868B] uppercase tracking-wider">
                  Billed To
                </div>
                <div className="text-sm font-semibold text-[#1D1D1F] mt-1">
                  {invoice.party_name || "Walk-in Customer"}
                </div>
                <div className="text-xs text-[#86868B] mt-0.5">
                  Payment Method: {invoice.payment_method}
                </div>
                {invoice.reference && (
                  <div className="text-xs text-[#86868B]">
                    Transaction Ref: {invoice.reference}
                  </div>
                )}
              </div>

              {/* Items Table */}
              <div className="py-4">
                <table className="w-full text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-black/[0.08] text-[#86868B] text-[11px]">
                      <th className="py-2.5 text-left font-semibold">Item</th>
                      <th className="py-2.5 text-center font-semibold whitespace-nowrap">Unit Price</th>
                      <th className="py-2.5 text-center font-semibold whitespace-nowrap">Qty</th>
                      <th className="py-2.5 text-right font-semibold whitespace-nowrap">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-black/[0.04]">
                    {items.map((item, idx) => (
                      <tr key={item.id || idx} className="hover:bg-black/[0.01]">
                        <td className="py-3 pr-3 align-top">
                          <div className="font-medium text-[#1D1D1F] leading-snug break-words">
                            {item.item_name}
                          </div>
                        </td>
                        <td className="py-3 px-2 text-center font-mono text-[#6E6E73] align-top whitespace-nowrap">
                          {formatCurrency(item.unit_price)}
                        </td>
                        <td className="py-3 px-2 text-center font-mono text-[#6E6E73] align-top whitespace-nowrap">
                          {item.quantity} {item.unit}
                        </td>
                        <td className="py-3 pl-2 text-right font-mono font-semibold text-[#1D1D1F] align-top whitespace-nowrap">
                          {formatCurrency(item.line_total)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Totals & Terms */}
              <div className="pt-5 border-t border-black/[0.08] flex justify-between items-start gap-6">
                <div className="flex-1 max-w-xs space-y-3">
                  <div>
                    <div className="text-[11px] font-semibold text-[#86868B] uppercase tracking-wider">
                      Terms & Conditions
                    </div>
                    <p className="text-[11px] text-[#86868B] leading-relaxed mt-1">
                      {settings.terms_and_conditions ||
                        "Thank you for doing business with us! Goods once sold cannot be returned without original receipt."}
                    </p>
                  </div>
                </div>

                <div className="w-56 space-y-2 text-xs shrink-0">
                  <div className="flex justify-between text-[#6E6E73]">
                    <span>Subtotal</span>
                    <span className="font-mono">
                      {formatCurrency(invoice.subtotal)}
                    </span>
                  </div>
                  {invoice.discount_amount > 0 && (
                    <div className="flex justify-between text-emerald-600 font-medium">
                      <span>Discount</span>
                      <span className="font-mono">
                        -{formatCurrency(invoice.discount_amount)}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between text-[#6E6E73]">
                    <span>{settings.tax_name || "Tax"}</span>
                    <span className="font-mono">
                      +{formatCurrency(invoice.tax_amount)}
                    </span>
                  </div>
                  <div className="flex justify-between items-baseline pt-2 border-t border-black/[0.08] text-sm font-bold text-[#1D1D1F]">
                    <span>Grand Total</span>
                    <span className="text-xl font-mono font-extrabold text-black">
                      {formatCurrency(invoice.total_amount)}
                    </span>
                  </div>
                  <div className="flex justify-between text-[11px] text-[#86868B] pt-1">
                    <span>Amount Paid</span>
                    <span className="font-mono font-medium">
                      {formatCurrency(invoice.paid_amount)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Authorized Signatory Section */}
              <div className="pt-8 border-t border-black/[0.06] mt-8 flex justify-between items-end">
                <div className="text-[10px] text-[#86868B] font-mono">
                  LynTerminal Business Engine · Offline Verified
                </div>
                <div className="text-right">
                  <div className="w-36 border-b border-black/30 mb-1 inline-block"></div>
                  <div className="text-[10px] font-semibold text-[#86868B] uppercase tracking-wider">
                    Authorized Signatory
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  </div>
);

return typeof document !== "undefined"
  ? createPortal(modalContent, document.body)
  : modalContent;
};
